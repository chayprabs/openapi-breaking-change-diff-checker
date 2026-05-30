import { analyzeOpenApiSpecs } from "@/features/openapi-diff/lib/parser";
import type { SpecInput } from "@/features/openapi-diff/types";
import {
  isAllowedOrigin,
  jsonResponse,
  originForbiddenResponse,
  rateLimitedResponse,
} from "@/lib/server/api-security";
import { getClientIpAddress } from "@/lib/server/simple-rate-limit";
import { consumeSharedRateLimit } from "@/lib/server/shared-rate-limit";

export const dynamic = "force-dynamic";

const GITHUB_CHECK_RATE_LIMIT = Math.max(1, Number(process.env.GITHUB_CHECK_RATE_LIMIT ?? 30));
const GITHUB_CHECK_RATE_LIMIT_WINDOW_MS = Math.max(
  1_000,
  Number(process.env.GITHUB_CHECK_RATE_LIMIT_WINDOW_MS ?? 60_000),
);
const GITHUB_CHECK_MAX_SPEC_BYTES = Math.max(
  1,
  Number(process.env.GITHUB_CHECK_MAX_SPEC_BYTES ?? 2 * 1024 * 1024),
);

function createGithubSpecInput(id: "base" | "revision", content: string): SpecInput {
  return {
    id,
    label: id === "base" ? "Base spec" : "Revision spec",
    content,
    format: "yaml",
    source: "paste",
    filename: `${id}.yaml`,
  };
}

function getConfiguredGithubSecret() {
  return process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() || null;
}

export async function POST(request: Request) {
  const configuredSecret = getConfiguredGithubSecret();

  if (process.env.NODE_ENV === "production" && !configuredSecret) {
    return jsonResponse({ error: "GitHub check is not configured." }, { status: 503 });
  }

  if (configuredSecret) {
    const secret = request.headers.get("x-builtin-github-secret");

    if (secret !== configuredSecret) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!isAllowedOrigin(request)) {
    return originForbiddenResponse();
  }

  const rateLimit = await consumeSharedRateLimit(
    `github-check:${getClientIpAddress(request.headers)}`,
    {
      limit: GITHUB_CHECK_RATE_LIMIT,
      windowMs: GITHUB_CHECK_RATE_LIMIT_WINDOW_MS,
    },
  );

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit);
  }

  let body: {
    baseContent?: string;
    revisionContent?: string;
  };

  try {
    body = (await request.json()) as {
      baseContent?: string;
      revisionContent?: string;
    };
  } catch {
    return jsonResponse({ error: "Invalid JSON payload." }, { rateLimit, status: 400 });
  }

  if (!body.baseContent || !body.revisionContent) {
    return jsonResponse(
      { error: "baseContent and revisionContent are required." },
      { rateLimit, status: 400 },
    );
  }

  if (
    body.baseContent.length > GITHUB_CHECK_MAX_SPEC_BYTES ||
    body.revisionContent.length > GITHUB_CHECK_MAX_SPEC_BYTES
  ) {
    return jsonResponse(
      {
        error: `Each spec must be ${GITHUB_CHECK_MAX_SPEC_BYTES} bytes or fewer.`,
      },
      { rateLimit, status: 413 },
    );
  }

  const result = await analyzeOpenApiSpecs(
    createGithubSpecInput("base", body.baseContent),
    createGithubSpecInput("revision", body.revisionContent),
  );

  if (!result.ok) {
    return jsonResponse({ errors: result.errors }, { rateLimit, status: 422 });
  }

  const breaking = result.result.report.summary.bySeverity.breaking;

  return jsonResponse(
    {
      breaking,
      conclusion: breaking > 0 ? "failure" : "success",
      recommendation: result.result.report.recommendation,
      title: breaking > 0 ? "Breaking OpenAPI changes detected" : "No breaking OpenAPI changes",
    },
    { rateLimit, status: 200 },
  );
}

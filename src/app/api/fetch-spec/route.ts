import {
  PublicSpecFetchError,
  isPublicSpecFetchError,
} from "@/features/openapi-diff/lib/public-spec-url";
import { fetchPublicSpecText } from "@/features/openapi-diff/lib/public-spec-fetch.server";
import {
  isAllowedOrigin,
  jsonResponse,
  originForbiddenResponse,
  rateLimitedResponse,
} from "@/lib/server/api-security";
import { getClientIpAddress } from "@/lib/server/simple-rate-limit";
import { consumeSharedRateLimit } from "@/lib/server/shared-rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FETCH_PROXY_RATE_LIMIT = Math.max(
  1,
  Number(process.env.OPENAPI_FETCH_PROXY_RATE_LIMIT ?? 20),
);
const FETCH_PROXY_RATE_LIMIT_WINDOW_MS = Math.max(
  1_000,
  Number(process.env.OPENAPI_FETCH_PROXY_RATE_LIMIT_WINDOW_MS ?? 60_000),
);

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return originForbiddenResponse();
  }

  const rateLimit = await consumeSharedRateLimit(
    `fetch-spec:${getClientIpAddress(request.headers)}`,
    {
      limit: FETCH_PROXY_RATE_LIMIT,
      windowMs: FETCH_PROXY_RATE_LIMIT_WINDOW_MS,
    },
  );

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit);
  }

  try {
    const body = (await request.json()) as { url?: unknown };

    if (typeof body.url !== "string") {
      throw new PublicSpecFetchError(
        "invalid-url",
        "A public http or https URL is required.",
        400,
      );
    }

    const result = await fetchPublicSpecText(body.url);

    return jsonResponse(
      {
        content: result.content,
        contentType: result.contentType,
        finalUrl: result.finalUrl,
        redirected: result.redirected,
      },
      {
        rateLimit,
        status: 200,
      },
    );
  } catch (error) {
    const failure = isPublicSpecFetchError(error)
      ? error
      : new PublicSpecFetchError(
          "fetch-failed",
          "The remote document could not be fetched.",
          502,
        );

    return jsonResponse(
      {
        code: failure.code,
        error: failure.message,
      },
      {
        rateLimit,
        status: failure.status,
      },
    );
  }
}

import {
  PublicSpecFetchError,
  isPublicSpecFetchError,
} from "@/features/openapi-diff/lib/public-spec-url";
import { fetchPublicSpecText } from "@/features/openapi-diff/lib/public-spec-fetch.server";
import {
  consumeSimpleRateLimit,
  getClientIpAddress,
} from "@/lib/server/simple-rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Vary: "Origin",
} as const;
const FETCH_PROXY_RATE_LIMIT = Math.max(
  1,
  Number(process.env.OPENAPI_FETCH_PROXY_RATE_LIMIT ?? 20),
);
const FETCH_PROXY_RATE_LIMIT_WINDOW_MS = Math.max(
  1_000,
  Number(process.env.OPENAPI_FETCH_PROXY_RATE_LIMIT_WINDOW_MS ?? 60_000),
);

export async function POST(request: Request) {
  const rateLimit = consumeSimpleRateLimit(
    `fetch-spec:${getClientIpAddress(request.headers)}`,
    {
      limit: FETCH_PROXY_RATE_LIMIT,
      windowMs: FETCH_PROXY_RATE_LIMIT_WINDOW_MS,
    },
  );
  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  if (!isAllowedOrigin(request)) {
    return Response.json(
      {
        code: "origin-not-allowed",
        error: "The safe proxy only accepts same-origin requests from the Authos app.",
      },
      {
        headers: {
          ...NO_STORE_HEADERS,
          ...rateLimitHeaders,
        },
        status: 403,
      },
    );
  }

  if (!rateLimit.allowed) {
    return Response.json(
      {
        code: "rate-limited",
        error: "Too many safe proxy requests. Wait a moment and try again.",
      },
      {
        headers: {
          ...NO_STORE_HEADERS,
          ...rateLimitHeaders,
        },
        status: 429,
      },
    );
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

    return Response.json(
      {
        content: result.content,
        contentType: result.contentType,
        finalUrl: result.finalUrl,
        redirected: result.redirected,
      },
      {
        headers: {
          ...NO_STORE_HEADERS,
          ...rateLimitHeaders,
        },
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

    return Response.json(
      {
        code: failure.code,
        error: failure.message,
      },
      {
        headers: {
          ...NO_STORE_HEADERS,
          ...rateLimitHeaders,
        },
        status: failure.status,
      },
    );
  }
}

function createRateLimitHeaders(rateLimit: {
  limit: number;
  remaining: number;
  resetAt: number;
}) {
  return {
    "Retry-After": String(
      Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
    ),
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };
}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

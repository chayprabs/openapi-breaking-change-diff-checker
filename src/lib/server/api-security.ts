import type { SimpleRateLimitResult } from "@/lib/server/simple-rate-limit";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Vary: "Origin",
} as const;

export function isAllowedOrigin(request: Request) {
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

export function createRateLimitHeaders(rateLimit: {
  limit: number;
  remaining: number;
  resetAt: number;
}) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit & { rateLimit?: SimpleRateLimitResult } = {},
) {
  const { rateLimit, headers, ...rest } = init;
  const responseHeaders = new Headers(headers);

  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    responseHeaders.set(key, value);
  }

  if (rateLimit) {
    for (const [key, value] of Object.entries(createRateLimitHeaders(rateLimit))) {
      responseHeaders.set(key, value);
    }
  }

  return Response.json(body, {
    ...rest,
    headers: responseHeaders,
  });
}

export function originForbiddenResponse(rateLimit?: SimpleRateLimitResult) {
  const init: ResponseInit & { rateLimit?: SimpleRateLimitResult } = {
    status: 403,
  };

  if (rateLimit) {
    init.rateLimit = rateLimit;
  }

  return jsonResponse(
    {
      code: "origin-not-allowed",
      error: "This endpoint only accepts same-origin requests from the OpenAPI Diff app.",
    },
    init,
  );
}

export function rateLimitedResponse(rateLimit: SimpleRateLimitResult) {
  return jsonResponse(
    {
      code: "rate-limited",
      error: "Too many requests. Wait a moment and try again.",
    },
    {
      rateLimit,
      status: 429,
    },
  );
}

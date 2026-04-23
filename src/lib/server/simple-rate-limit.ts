type SimpleRateLimitOptions = {
  limit: number;
  now?: () => number;
  windowMs: number;
};

export type SimpleRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type RateLimitWindow = {
  count: number;
  resetAt: number;
};

const rateLimitWindows = new Map<string, RateLimitWindow>();

export function consumeSimpleRateLimit(
  key: string,
  options: SimpleRateLimitOptions,
): SimpleRateLimitResult {
  const now = options.now?.() ?? Date.now();
  const normalizedKey = key.trim() || "anonymous";
  pruneExpiredWindows(now);

  const existing = rateLimitWindows.get(normalizedKey);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    rateLimitWindows.set(normalizedKey, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      limit: options.limit,
      remaining: Math.max(0, options.limit - 1),
      resetAt,
    };
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function getClientIpAddress(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();

    if (first) {
      return first;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  return "anonymous";
}

function pruneExpiredWindows(now: number) {
  for (const [key, value] of rateLimitWindows.entries()) {
    if (value.resetAt <= now) {
      rateLimitWindows.delete(key);
    }
  }
}

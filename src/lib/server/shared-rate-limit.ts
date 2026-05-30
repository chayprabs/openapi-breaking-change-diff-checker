import { consumeSimpleRateLimit, type SimpleRateLimitResult } from "@/lib/server/simple-rate-limit";

type SharedRateLimitOptions = {
  limit: number;
  windowMs: number;
};

export async function consumeSharedRateLimit(
  key: string,
  options: SharedRateLimitOptions,
): Promise<SimpleRateLimitResult> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (upstashUrl && upstashToken) {
    try {
      return await consumeUpstashRateLimit(key, options, upstashUrl, upstashToken);
    } catch {
      return consumeSimpleRateLimit(key, options);
    }
  }

  return consumeSimpleRateLimit(key, options);
}

async function consumeUpstashRateLimit(
  key: string,
  options: SharedRateLimitOptions,
  upstashUrl: string,
  upstashToken: string,
): Promise<SimpleRateLimitResult> {
  const windowKey = `odiff:ratelimit:${key}:${Math.floor(Date.now() / options.windowMs)}`;
  const response = await fetch(`${upstashUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", windowKey],
      ["EXPIRE", windowKey, Math.ceil(options.windowMs / 1000)],
    ]),
  });

  if (!response.ok) {
    throw new Error("Upstash rate limit request failed.");
  }

  const body = (await response.json()) as { result?: unknown[] };
  const count = Number(body.result?.[0] ?? 0);
  const resetAt = Math.ceil(Date.now() / options.windowMs) * options.windowMs;

  return {
    allowed: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    resetAt,
  };
}

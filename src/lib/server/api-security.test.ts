import { describe, expect, it } from "vitest";
import {
  createRateLimitHeaders,
  isAllowedOrigin,
  originForbiddenResponse,
} from "@/lib/server/api-security";

describe("api security helpers", () => {
  it("allows same-origin requests and rejects cross-origin requests", () => {
    expect(
      isAllowedOrigin(
        new Request("http://localhost/api/feedback", {
          headers: { origin: "http://localhost" },
          method: "POST",
        }),
      ),
    ).toBe(true);

    expect(
      isAllowedOrigin(
        new Request("http://localhost/api/feedback", {
          headers: { origin: "https://evil.example" },
          method: "POST",
        }),
      ),
    ).toBe(false);
  });

  it("returns no-store headers on origin rejection", async () => {
    const response = originForbiddenResponse({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
  });

  it("builds retry-after headers from the rate limit window", () => {
    const headers = createRateLimitHeaders({
      limit: 5,
      remaining: 2,
      resetAt: Date.now() + 15_000,
    });

    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });
});

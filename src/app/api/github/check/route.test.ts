import { describe, expect, it } from "vitest";
import {
  baseSampleOpenApi31,
  revisionSampleOpenApi31,
} from "@/features/openapi-diff/fixtures";
import { POST } from "./route";

function createRequest(body: unknown, secret?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["x-authos-github-secret"] = secret;
  }

  return new Request("http://localhost/api/github/check", {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });
}

describe("POST /api/github/check", () => {
  it("returns 400 when required spec bodies are missing", async () => {
    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "baseContent and revisionContent are required.",
    });
  });

  it("returns success conclusion when no breaking changes are present", async () => {
    const response = await POST(
      createRequest({
        baseContent: baseSampleOpenApi31,
        revisionContent: baseSampleOpenApi31,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conclusion).toBe("success");
    expect(body.breaking).toBe(0);
  });

  it("returns failure conclusion when breaking changes are present", async () => {
    const response = await POST(
      createRequest({
        baseContent: baseSampleOpenApi31,
        revisionContent: revisionSampleOpenApi31,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conclusion).toBe("failure");
    expect(body.breaking).toBeGreaterThan(0);
  });

  it("returns 401 when webhook secret is configured and header is wrong", async () => {
    const previous = process.env.GITHUB_APP_WEBHOOK_SECRET;
    process.env.GITHUB_APP_WEBHOOK_SECRET = "expected-secret";

    try {
      const response = await POST(
        createRequest(
          {
            baseContent: baseSampleOpenApi31,
            revisionContent: baseSampleOpenApi31,
          },
          "wrong-secret",
        ),
      );

      expect(response.status).toBe(401);
    } finally {
      if (previous === undefined) {
        delete process.env.GITHUB_APP_WEBHOOK_SECRET;
      } else {
        process.env.GITHUB_APP_WEBHOOK_SECRET = previous;
      }
    }
  });
});

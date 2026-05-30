import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/db", () => {
  const values = vi.fn().mockResolvedValue(undefined);

  return {
    ensureDatabaseReady: vi.fn().mockResolvedValue(undefined),
    db: {
      insert: vi.fn().mockReturnValue({ values }),
    },
  };
});

function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/feedback", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    method: "POST",
  });
}

describe("POST /api/feedback", () => {
  it("returns 403 for cross-origin requests", async () => {
    const response = await POST(
      createRequest(
        {
          kind: "idea",
          message: "Add a keyboard shortcut for re-run.",
          page: "/tools/openapi-diff-breaking-changes",
          rating: 5,
          tool: "openapi_diff",
          toolVersion: "test",
        },
        { origin: "https://evil.example" },
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "origin-not-allowed",
    });
  });

  it("returns 400 when message is missing", async () => {
    const response = await POST(
      createRequest({
        kind: "bug",
        message: "   ",
        page: "/tools/openapi-diff-breaking-changes",
        rating: 3,
        tool: "openapi_diff",
        toolVersion: "test",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Message is required." });
  });

  it("returns 400 when message looks like raw spec content", async () => {
    const response = await POST(
      createRequest({
        kind: "bug",
        message: `openapi: 3.1.0
info:
  title: Demo
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
components:
  schemas: {}`,
        page: "/tools/openapi-diff-breaking-changes",
        rating: 3,
        tool: "openapi_diff",
        toolVersion: "test",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Feedback must not include raw spec content.",
    });
  });

  it("accepts valid feedback and returns ok", async () => {
    const response = await POST(
      createRequest({
        kind: "idea",
        message: "Add a keyboard shortcut for re-run.",
        page: "/tools/openapi-diff-breaking-changes",
        rating: 5,
        tool: "openapi_diff",
        toolVersion: "test",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

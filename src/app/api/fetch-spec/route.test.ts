import { describe, expect, it } from "vitest";
import { POST } from "./route";

function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/fetch-spec", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    method: "POST",
  });
}

describe("POST /api/fetch-spec", () => {
  it("returns 403 for cross-origin requests", async () => {
    const response = await POST(
      createRequest(
        { url: "https://example.com/openapi.yaml" },
        { origin: "https://evil.example" },
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "origin-not-allowed",
    });
  });

  it("returns 400 when url is missing or not a string", async () => {
    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid-url",
    });
  });

  it("blocks localhost URLs with a safe error", async () => {
    const response = await POST(createRequest({ url: "http://127.0.0.1/openapi.yaml" }));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ code: "blocked-host" });
    expect(JSON.stringify(body)).not.toContain("127.0.0.1");
  });
});

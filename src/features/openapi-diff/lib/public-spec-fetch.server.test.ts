import { describe, expect, it, vi } from "vitest";
import { fetchPublicSpecText } from "@/features/openapi-diff/lib/public-spec-fetch.server";
import {
  PublicSpecFetchError,
  validatePublicSpecUrl,
} from "@/features/openapi-diff/lib/public-spec-url";

describe("public spec URL validation", () => {
  it("blocks localhost and private IPv4 URLs", () => {
    expectBlockedUrl("http://localhost/openapi.yaml");
    expectBlockedUrl("http://127.0.0.1/openapi.yaml");
    expectBlockedUrl("http://10.0.0.12/openapi.yaml");
    expectBlockedUrl("http://192.168.1.10/openapi.yaml");
  });

  it("allows a normal public https URL", () => {
    const result = validatePublicSpecUrl(
      "https://raw.githubusercontent.com/acme/api/main/openapi.yaml",
    );

    expect(result.url.toString()).toBe(
      "https://raw.githubusercontent.com/acme/api/main/openapi.yaml",
    );
  });
});

describe("fetchPublicSpecText", () => {
  it("blocks redirects to private IP targets", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, {
        headers: {
          location: "http://127.0.0.1/internal.yaml",
        },
        status: 302,
      }),
    );

    await expect(
      fetchPublicSpecText("https://example.com/openapi.yaml", {
        fetchImpl,
        lookupIpAddresses: async (hostname) =>
          hostname === "example.com" ? ["93.184.216.34"] : ["127.0.0.1"],
      }),
    ).rejects.toMatchObject({
      code: "blocked-redirect",
    });
  });

  it("rejects oversized responses", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("x".repeat(2_048), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
        status: 200,
      }),
    );

    await expect(
      fetchPublicSpecText("https://example.com/openapi.yaml", {
        fetchImpl,
        lookupIpAddresses: async () => ["93.184.216.34"],
        maxBytes: 1_024,
      }),
    ).rejects.toMatchObject({
      code: "response-too-large",
    });
  });
});

function expectBlockedUrl(url: string) {
  try {
    validatePublicSpecUrl(url);
  } catch (error) {
    expect(error).toBeInstanceOf(PublicSpecFetchError);
    expect((error as PublicSpecFetchError).code).toBe("blocked-host");
    return;
  }

  throw new Error(`Expected ${url} to be blocked.`);
}

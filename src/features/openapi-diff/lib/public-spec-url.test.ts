import { describe, expect, it } from "vitest";
import {
  assertAllowedSpecContentType,
  getBlockedHostnameReason,
  normalizeHostname,
  PublicSpecFetchError,
  readResponseTextWithLimit,
  validatePublicSpecUrl,
} from "@/features/openapi-diff/lib/public-spec-url";

describe("public spec URL safety", () => {
  it("blocks unsupported protocols, auth URLs, internal hosts, and private IPv6 targets", () => {
    expectErrorCode("ftp://example.com/openapi.yaml", "unsupported-protocol");
    expectErrorCode("https://user:pass@example.com/openapi.yaml", "authenticated-urls-not-supported");
    expectErrorCode("https://service/openapi.yaml", "blocked-host");
    expectErrorCode("https://metadata.google.internal/openapi.yaml", "blocked-host");
    expectErrorCode("https://[::1]/openapi.yaml", "blocked-host");
    expectErrorCode("https://[fd00::1]/openapi.yaml", "blocked-host");
  });

  it("normalizes hostnames and exposes the blocked-host reason helpers", () => {
    expect(normalizeHostname("Example.COM.")).toBe("example.com");
    expect(normalizeHostname("[FD00::1]")).toBe("fd00::1");
    expect(getBlockedHostnameReason("localhost")).toBe(
      "Private, localhost, and metadata-service URLs are blocked.",
    );
    expect(getBlockedHostnameReason("service")).toBe(
      "Internal hostnames without a public domain are blocked.",
    );
    expect(getBlockedHostnameReason("example.com")).toBeNull();
  });

  it("allows text and OpenAPI-ish content types while blocking binary responses", () => {
    expect(() =>
      assertAllowedSpecContentType(
        "application/vnd.oai.openapi+json; charset=utf-8",
        "https://example.com/openapi.json",
      ),
    ).not.toThrow();
    expect(() =>
      assertAllowedSpecContentType(
        "application/x-yaml",
        "https://example.com/openapi.yaml",
      ),
    ).not.toThrow();
    expect(() =>
      assertAllowedSpecContentType(
        "application/octet-stream",
        "https://example.com/openapi.bin",
      ),
    ).toThrow(PublicSpecFetchError);
  });

  it("enforces the response size limit for both streaming and non-streaming responses", async () => {
    await expect(
      readResponseTextWithLimit(
        new Response("small payload", {
          headers: {
            "content-type": "text/plain",
          },
        }),
        4,
      ),
    ).rejects.toMatchObject({
      code: "response-too-large",
    });

    const largeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("hello"));
        controller.enqueue(new TextEncoder().encode("world"));
        controller.close();
      },
    });
    const response = new Response(largeStream, {
      headers: {
        "content-type": "text/plain",
      },
    });

    await expect(readResponseTextWithLimit(response, 8)).rejects.toMatchObject({
      code: "response-too-large",
    });
  });

  it("returns a validated public URL when the input is safe", () => {
    const result = validatePublicSpecUrl("https://raw.githubusercontent.com/acme/api/main/openapi.yaml");

    expect(result.url.hostname).toBe("raw.githubusercontent.com");
    expect(result.url.pathname).toBe("/acme/api/main/openapi.yaml");
  });
});

function expectErrorCode(input: string, code: PublicSpecFetchError["code"]) {
  expect(() => validatePublicSpecUrl(input)).toThrowError(
    expect.objectContaining({
      code,
    }),
  );
}

import { describe, expect, it } from "vitest";
import {
  createDisabledAnalyticsAdapter,
  getAnalyticsPageId,
  getConfiguredAnalyticsProvider,
  getReferrerType,
} from "@/lib/analytics-core";

describe("analytics core", () => {
  it("defaults analytics to disabled until a provider is configured", () => {
    expect(getConfiguredAnalyticsProvider(undefined)).toBe("disabled");
    expect(getConfiguredAnalyticsProvider("")).toBe("disabled");
    expect(getConfiguredAnalyticsProvider("unknown")).toBe("disabled");
  });

  it("recognizes supported providers and page identifiers", () => {
    expect(getConfiguredAnalyticsProvider("plausible")).toBe("plausible");
    expect(getConfiguredAnalyticsProvider("posthog")).toBe("posthog");
    expect(getAnalyticsPageId("/tools/openapi-diff-breaking-changes")).toBe("openapi_diff");
    expect(getAnalyticsPageId("/login")).toBe("login");
    expect(getAnalyticsPageId("/missing")).toBe("unknown");
  });

  it("classifies referrers without leaking the original URL", () => {
    expect(getReferrerType("https://authos.dev", "")).toBe("none");
    expect(getReferrerType("https://authos.dev", "https://authos.dev/tools")).toBe("internal");
    expect(getReferrerType("https://authos.dev", "https://example.com/path")).toBe("external");
  });

  it("exposes a stable disabled adapter shape", () => {
    const adapter = createDisabledAnalyticsAdapter();

    expect(adapter.enabled).toBe(false);
    expect(adapter.provider).toBe("disabled");
    expect(() => adapter.track({ name: "page_view" })).not.toThrow();
  });
});

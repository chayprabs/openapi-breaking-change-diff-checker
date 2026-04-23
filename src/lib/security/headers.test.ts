import { describe, expect, it } from "vitest";
import {
  buildAppContentSecurityPolicy,
  getAppSecurityHeaders,
} from "@/lib/security/headers";

describe("app security headers", () => {
  it("builds a workable CSP for the editor, worker, and export flows", () => {
    const csp = buildAppContentSecurityPolicy({ isDevelopment: false });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("connect-src 'self' http: https: ws: wss:");
    expect(csp).toContain("form-action 'self' mailto:");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("adds development-only eval support when requested", () => {
    const csp = buildAppContentSecurityPolicy({ isDevelopment: true });

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("returns the strict response headers expected by Next config", () => {
    const headers = getAppSecurityHeaders({ isDevelopment: false });
    const headerMap = new Map(headers.map((header) => [header.key, header.value]));

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});

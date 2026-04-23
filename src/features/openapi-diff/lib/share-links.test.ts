import { describe, expect, it } from "vitest";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import {
  buildRedactedReportShareLink,
  buildSettingsShareLink,
  parseShareStateFromUrl,
  REPORT_SHARE_TOO_LARGE_MESSAGE,
} from "@/features/openapi-diff/lib/share-links";
import { createDefaultReportExplorerUiState } from "@/features/openapi-diff/lib/ui-state";
import type { DiffFinding, DiffReport, ParsedSpec } from "@/features/openapi-diff/types";

function createParsedSpec(label: string): ParsedSpec {
  return {
    byteCount: 256,
    componentsOnly: false,
    externalRefCount: 0,
    input: {
      filename: `${label.toLowerCase().replace(/\s+/g, "-")}.yaml`,
      format: "yaml",
      id: label.toLowerCase(),
      label,
      source: "url",
      url: `https://${label.toLowerCase().replace(/\s+/g, "-")}.example.com/openapi.yaml`,
    },
    lineCount: 24,
    localRefCount: 0,
    pathCount: 2,
    schemaCount: 1,
    unresolvedRefs: [],
    validationSource: "lightweight",
    version: {
      family: "openapi-3.1.x",
      label: "OpenAPI 3.1.0 detected",
      raw: "3.1.0",
      sourceField: "openapi",
      supported: true,
    },
    warnings: [],
  };
}

function createFinding(
  id: string,
  overrides: Partial<DiffFinding> = {},
): DiffFinding {
  return {
    afterValue: null,
    baseSeverity: "dangerous",
    beforeValue: null,
    category: "response",
    evidence: {},
    id,
    jsonPointer: "#/paths/~1users/get/responses/200",
    message: "Response changed.",
    method: "get",
    path: "/users",
    ruleId: "response.status.removed",
    severity: "breaking",
    severityReason: "Existing clients can fail immediately.",
    title: "Response removed",
    whyItMatters: "Clients rely on this response shape.",
    ...overrides,
  };
}

function createReport(findings: DiffFinding[]): DiffReport {
  const activeFindings = findings.filter((finding) => !finding.ignored);

  return {
    affectedEndpoints: [
      {
        findingCount: activeFindings.length || 1,
        highestSeverity: "breaking",
        key: "/users::get",
        method: "get",
        path: "/users",
        ruleIds: activeFindings.map((finding) => finding.ruleId),
      },
    ],
    affectedSchemas: [
      {
        findingCount: 1,
        highestSeverity: "dangerous",
        humanPaths: ["User.status"],
        jsonPointers: ["#/components/schemas/User/properties/status"],
        key: "user",
        label: "User",
        ruleIds: ["schema.enum.value.added"],
      },
    ],
    baseline: createParsedSpec("Base Spec"),
    candidate: createParsedSpec("Revision Spec"),
    executiveSummary: "Summary",
    findings,
    generatedAt: "2026-04-23T00:00:00.000Z",
    migrationNotes: ["Coordinate the rollout with existing consumers."],
    recommendation: {
      code: "blockRelease",
      label: "Block release",
      reason: "Breaking changes are present.",
    },
    riskScore: 84,
    sdkImpactSummary: "Generated SDKs will need a refresh.",
    securitySummary: "No direct auth change was detected.",
    settings: createAnalysisSettings({
      customRedactionRules: [
        {
          id: "corp-domain",
          label: "Corp domain",
          pattern: "internal\\.corp",
        },
      ],
      ignoreRules: [
        {
          id: "ruleId:operationId.changed",
          label: "Rule operationId.changed",
          reason: "Ignore SDK rename churn during rollout.",
          ruleId: "operationId.changed",
          source: "ruleId",
        },
      ],
      redactExamples: true,
      redactServerUrls: true,
    }),
    successState: null,
    summary: {
      byCategory: {
        docs: 0,
        operations: 0,
        parameters: 0,
        paths: 0,
        responses: activeFindings.length,
        schemas: 0,
        security: 0,
      },
      bySeverity: {
        breaking: activeFindings.filter((finding) => finding.severity === "breaking").length,
        dangerous: activeFindings.filter((finding) => finding.severity === "dangerous").length,
        info: activeFindings.filter((finding) => finding.severity === "info").length,
        safe: activeFindings.filter((finding) => finding.severity === "safe").length,
      },
      ignoredFindings: findings.filter((finding) => finding.ignored).length,
      totalFindings: activeFindings.length,
    },
    topReviewItems: activeFindings.slice(0, 2).map((finding) => ({
      id: finding.id,
      jsonPointer: finding.jsonPointer,
      message: finding.message,
      method: finding.method,
      path: finding.path,
      severity: finding.severity,
      title: finding.title,
    })),
    warnings: [],
  };
}

function decodeSettingsPayloadFromUrl(url: string) {
  const parsed = new URL(url);
  const hashParams = new URLSearchParams(parsed.hash.slice(1));
  const payload = hashParams.get("payload");

  if (!payload) {
    throw new Error("Missing payload");
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  return JSON.parse(Buffer.from(`${normalized}${padding}`, "base64").toString("utf8")) as Record<
    string,
    unknown
  >;
}

describe("share links", () => {
  it("builds a settings-only link that round-trips profile, ignore rules, and UI state", () => {
    const uiState = createDefaultReportExplorerUiState();
    const settings = createAnalysisSettings({
      consumerProfile: "sdkStrict",
      ignoreRules: [
        {
          id: "pathPattern:/internal/*",
          label: "Path /internal/*",
          pathPattern: "/internal/*",
          reason: "Ignore private routes during partner review.",
          source: "pathPattern",
        },
      ],
    });
    const url = buildSettingsShareLink("https://authos.dev/tools/openapi-diff", settings, {
      activeMobileTab: "results",
      reportExplorer: {
        ...uiState,
        activeTab: "findings",
        filters: {
          ...uiState.filters,
          path: "/users",
          search: "response removed",
        },
      },
    });
    const parsed = parseShareStateFromUrl(url);
    const rawPayload = decodeSettingsPayloadFromUrl(url);

    expect(parsed.mode).toBe("settings");
    expect(parsed.mode === "settings" ? parsed.analysisSettings.consumerProfile : null).toBe(
      "sdkStrict",
    );
    expect(parsed.mode === "settings" ? parsed.analysisSettings.ignoreRules[0]?.pathPattern : null).toBe(
      "/internal/*",
    );
    expect(parsed.mode === "settings" ? parsed.ui.reportExplorer.activeTab : null).toBe(
      "findings",
    );
    expect(parsed.mode === "settings" ? parsed.ui.reportExplorer.filters.search : null).toBe(
      "response removed",
    );
    expect(rawPayload).not.toHaveProperty("report");
    expect(rawPayload).not.toHaveProperty("specs");
  });

  it("builds a redacted report link without obvious secrets and opens in results mode", () => {
    const report = createReport([
      createFinding("secret-report", {
        message:
          "Contact reviewer@example.com before calling https://internal.corp/users with token sk_test_1234567890abcdef and 10.2.3.4.",
        whyItMatters:
          "This can leak reviewer@example.com and internal.corp if it is shared without redaction.",
      }),
    ]);
    const result = buildRedactedReportShareLink(
      "https://authos.dev/tools/openapi-diff",
      report,
      {
        activeMobileTab: "base",
        reportExplorer: createDefaultReportExplorerUiState(),
      },
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.url).not.toContain("reviewer@example.com");
    expect(result.url).not.toContain("internal.corp");
    expect(result.url).not.toContain("sk_test_1234567890abcdef");
    expect(result.url).not.toContain("10.2.3.4");

    const parsed = parseShareStateFromUrl(result.url);

    expect(parsed.mode).toBe("report");
    expect(parsed.mode === "report" ? parsed.ui.activeMobileTab : null).toBe("results");
    expect(parsed.mode === "report" ? parsed.report.findings[0]?.message : null).toContain(
      "<EMAIL_1>",
    );
    expect(parsed.mode === "report" ? parsed.report.findings[0]?.message : null).not.toContain(
      "reviewer@example.com",
    );
  });

  it("rejects oversized report links with the HTML fallback message", () => {
    const report = createReport([
      ...Array.from({ length: 8 }, (_, index) =>
        createFinding(`oversized-${index}`, {
          message: `Unique payload ${index} ${"x".repeat(400)} ${index}`,
          whyItMatters: `Another unique payload ${index} ${"y".repeat(400)} ${index}`,
        }),
      ),
    ]);
    const result = buildRedactedReportShareLink(
      "https://authos.dev/tools/openapi-diff",
      report,
      {
        activeMobileTab: "results",
        reportExplorer: createDefaultReportExplorerUiState(),
      },
      {
        maxUrlLength: 300,
      },
    );

    expect(result).toEqual({
      message: REPORT_SHARE_TOO_LARGE_MESSAGE,
      ok: false,
      reason: "too_large",
    });
  });
});

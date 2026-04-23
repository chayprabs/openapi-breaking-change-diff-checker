import { describe, expect, it } from "vitest";
import { diffReportSchema } from "@/features/openapi-diff/engine/report";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import { createReportExportBundle } from "@/features/openapi-diff/lib/report-export";
import { createReportFindingRows } from "@/features/openapi-diff/lib/report-explorer";
import { TOOL_VERSION } from "@/lib/tool-version";
import type { DiffFinding, DiffReport, ParsedSpec } from "@/features/openapi-diff/types";

function createParsedSpec(label: string): ParsedSpec {
  return {
    byteCount: 128,
    componentsOnly: false,
    externalRefCount: 0,
    input: {
      filename: `${label.toLowerCase().replace(/\s+/g, "-")}.yaml`,
      format: "yaml",
      id: label.toLowerCase(),
      label,
      source: "sample",
    },
    lineCount: 16,
    localRefCount: 0,
    pathCount: 1,
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
    baseSeverity: "safe",
    beforeValue: null,
    category: "operation",
    evidence: {},
    id,
    jsonPointer: "#/paths/~1users/get",
    message: "Finding message",
    method: "get",
    path: "/users",
    ruleId: "operation.added",
    severity: "safe",
    severityReason: "Default reason",
    title: "Finding title",
    whyItMatters: "Finding impact",
    ...overrides,
  };
}

function createReport(findings: DiffFinding[]): DiffReport {
  const activeFindings = findings.filter((finding) => !finding.ignored);

  return {
    affectedEndpoints: [
      {
        findingCount: activeFindings.filter((finding) => finding.path === "/users").length || 1,
        highestSeverity: "breaking",
        key: "/users::get",
        method: "get",
        path: "/users",
        ruleIds: [
          "operation.added",
          "operationId.changed",
          "response.status.removed",
          "schema.property.added.optional",
        ],
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
    baseline: createParsedSpec("Base spec"),
    candidate: createParsedSpec("Revision spec"),
    executiveSummary: "Summary",
    findings,
    generatedAt: "2026-04-23T00:00:00.000Z",
    migrationNotes: [],
    recommendation: {
      code: "reviewBeforeRelease",
      label: "Review before release",
      reason: "Reason",
    },
    riskScore: 42,
    sdkImpactSummary: "SDK summary",
    securitySummary: "Security summary",
    settings: createAnalysisSettings({
      ignoreRules: [
        {
          id: "ruleId:operationId.changed",
          label: "Rule operationId.changed",
          reason: "Ignore rename churn during SDK cleanup.",
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
        docs: activeFindings.filter((finding) => finding.category === "docs").length,
        operations: activeFindings.filter((finding) => finding.category === "operation").length,
        parameters: activeFindings.filter((finding) => finding.category === "parameter").length,
        paths: activeFindings.filter((finding) => finding.category === "path").length,
        responses: activeFindings.filter((finding) => finding.category === "response").length,
        schemas: activeFindings.filter((finding) =>
          finding.category === "schema" || finding.category === "enum",
        ).length,
        security: activeFindings.filter((finding) => finding.category === "security").length,
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
    topReviewItems: [],
    warnings: [],
  };
}

describe("report export bundle", () => {
  it("builds markdown with the required PR-ready sections", () => {
    const report = createReport([
      createFinding("breaking-item", {
        category: "response",
        message: "GET /users removed the 200 response.",
        ruleId: "response.status.removed",
        severity: "breaking",
        title: "Response removed",
      }),
      createFinding("dangerous-item", {
        category: "metadata",
        message: "operationId changed from listUsers to fetchUsers.",
        ruleId: "operationId.changed",
        severity: "dangerous",
        title: "Operation ID changed",
      }),
      createFinding("safe-item", {
        category: "schema",
        humanPath: "User.nickname",
        jsonPointer: "#/components/schemas/User/properties/nickname",
        ruleId: "schema.property.added.optional",
        severity: "safe",
        title: "Optional property added",
      }),
      createFinding("ignored-item", {
        category: "metadata",
        ignored: true,
        ignoredBy: [
          {
            id: "ruleId:operationId.changed",
            label: "Rule operationId.changed",
            reason: "Ignore rename churn during SDK cleanup.",
            source: "ruleId",
          },
        ],
        message: "operationId changed from listUsers to fetchUsers.",
        ruleId: "operationId.changed",
        severity: "dangerous",
        title: "Ignored operation ID change",
      }),
    ]);

    const bundle = createReportExportBundle(report, createReportFindingRows(report), {
      includeIgnoredFindings: false,
      includeSafeChanges: false,
      redactBeforeExport: false,
    });
    const markdown = bundle.artifacts.markdown.content;

    expect(markdown).toContain("# OpenAPI Diff PR Report");
    expect(markdown).toContain("## Base And Revision Metadata");
    expect(markdown).toContain("## Selected Profile And Settings Summary");
    expect(markdown).toContain("## Overall Recommendation");
    expect(markdown).toContain("## Severity Counts");
    expect(markdown).toContain("## Top Breaking Changes");
    expect(markdown).toContain("## Dangerous Changes");
    expect(markdown).toContain("## Safe Changes Summary");
    expect(markdown).toContain("## Ignored Findings Summary");
    expect(markdown).toContain("## Rule IDs And Affected Paths");
    expect(markdown).toContain("## Redaction Status");
    expect(markdown).toContain("Generated by Authos v0.1.0");
    expect(markdown).toContain("- Include safe changes in export: No");
    expect(markdown).toContain("- Include ignored findings in export: No");
    expect(markdown).toContain("- `response.status.removed` on `GET /users`");
  });

  it("escapes HTML content and keeps a print-friendly collapsible layout", () => {
    const report = createReport([
      createFinding("html-item", {
        category: "response",
        message: "<script>alert('xss')</script>",
        ruleId: "response.status.removed",
        severity: "breaking",
        title: "<b>Response removed</b>",
      }),
    ]);

    const bundle = createReportExportBundle(report, createReportFindingRows(report), {
      includeIgnoredFindings: false,
      includeSafeChanges: true,
      redactBeforeExport: false,
    });
    const html = bundle.artifacts.html.content;

    expect(html).toContain("@media print");
    expect(html).toContain('<details class="finding" open>');
    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;Response removed&lt;/b&gt;");
    expect(html).not.toContain("<script>alert('xss')</script>");
    expect(html).not.toContain("<b>Response removed</b>");
  });

  it("builds JSON with tool metadata and a schema-valid DiffReport payload", () => {
    const report = createReport([
      createFinding("json-item", {
        category: "response",
        ruleId: "response.status.removed",
        severity: "breaking",
        title: "Response removed",
      }),
    ]);

    const bundle = createReportExportBundle(report, createReportFindingRows(report), {
      includeIgnoredFindings: true,
      includeSafeChanges: true,
      redactBeforeExport: false,
    });
    const parsed = JSON.parse(bundle.artifacts.json.content) as Record<string, unknown>;

    expect(diffReportSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.toolVersion).toBe(TOOL_VERSION);
    expect(parsed.exportFormat).toBe("json");
    expect(parsed.settings).toMatchObject({
      consumerProfile: "publicApi",
      redactExamples: true,
      redactServerUrls: true,
    });
    expect(parsed.redactionStatus).toMatchObject({
      exportRedacted: false,
      redactExamples: true,
      redactServerUrls: true,
    });
  });

  it("redacts markdown, HTML, and JSON exports without breaking JSON validity", () => {
    const report = createReport([
      createFinding("redaction-item", {
        category: "response",
        message:
          "Contact reviewer@example.com before calling internal.corp with token sk_test_1234567890abcdef.",
        ruleId: "response.status.removed",
        severity: "breaking",
        title: "Response removed",
      }),
    ]);

    const bundle = createReportExportBundle(report, createReportFindingRows(report), {
      includeIgnoredFindings: true,
      includeSafeChanges: true,
      redactBeforeExport: true,
    });

    expect(bundle.inspection.detectedSecrets).toBe(true);
    expect(bundle.artifacts.markdown.content).not.toContain("reviewer@example.com");
    expect(bundle.artifacts.markdown.content).toContain("&lt;EMAIL_1&gt;");
    expect(bundle.artifacts.html.content).not.toContain("reviewer@example.com");
    expect(bundle.artifacts.html.content).toContain("&lt;EMAIL_1&gt;");
    expect(bundle.artifacts.html.content).not.toContain("<EMAIL_1>");
    expect(bundle.artifacts.json.content).not.toContain("reviewer@example.com");
    expect(bundle.artifacts.json.content).toContain("<EMAIL_1>");
    expect(() => JSON.parse(bundle.artifacts.json.content)).not.toThrow();
  });
});

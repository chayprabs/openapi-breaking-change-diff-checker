import { describe, expect, it } from "vitest";
import {
  createDefaultFindingsExplorerFilters,
  createFindingsCsv,
  createReportFindingRows,
  createReportHtml,
  createReportMarkdown,
  filterAndSortFindingRows,
} from "@/features/openapi-diff/lib/report-explorer";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import type { DiffFinding, DiffReport, ParsedSpec } from "@/features/openapi-diff/types";

function createParsedSpec(label: string): ParsedSpec {
  return {
    byteCount: 128,
    componentsOnly: false,
    externalRefCount: 0,
    input: {
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
        findingCount: activeFindings.length,
        highestSeverity: "breaking",
        key: "/users::get",
        method: "get",
        path: "/users",
        ruleIds: ["operation.added"],
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
    baseline: createParsedSpec("Base"),
    candidate: createParsedSpec("Revision"),
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
    settings: createAnalysisSettings(),
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

describe("report explorer helpers", () => {
  it("derives schema labels and filters findings across fields", () => {
    const report = createReport([
      createFinding("breaking-endpoint", {
        category: "response",
        message: "GET /users removed the 200 response.",
        ruleId: "response.status.removed",
        severity: "breaking",
        title: "Response status removed",
      }),
      createFinding("dangerous-schema", {
        category: "enum",
        humanPath: "User.status",
        jsonPointer: "#/components/schemas/User/properties/status",
        message: "User.status added a new enum value.",
        method: null,
        path: null,
        ruleId: "schema.enum.value.added",
        severity: "dangerous",
        title: "Enum value added",
      }),
      createFinding("safe-security", {
        category: "security",
        message: "OAuth scope changed.",
        operationId: "listUsers",
        ruleId: "security.scope.added",
        severity: "safe",
        title: "Security scope added",
      }),
    ]);
    const rows = createReportFindingRows(report);

    expect(rows.find((row) => row.finding.id === "dangerous-schema")?.schemaLabel).toBe("User");

    const schemaFilters = createDefaultFindingsExplorerFilters();
    schemaFilters.schema = "User";

    expect(filterAndSortFindingRows(rows, schemaFilters).map((row) => row.finding.id)).toEqual([
      "dangerous-schema",
    ]);

    const searchFilters = createDefaultFindingsExplorerFilters();
    searchFilters.search = "listUsers scope";

    expect(filterAndSortFindingRows(rows, searchFilters).map((row) => row.finding.id)).toEqual([
      "safe-security",
    ]);
  });

  it("sorts by severity and exports a csv table", () => {
    const report = createReport([
      createFinding("safe-item", {
        message: "Safe change.",
        ruleId: "operation.added",
        severity: "safe",
        title: "Operation added",
      }),
      createFinding("breaking-item", {
        category: "response",
        message: "Breaking change.",
        ruleId: "response.status.removed",
        severity: "breaking",
        title: "Response removed",
      }),
    ]);
    const rows = createReportFindingRows(report);
    const filters = createDefaultFindingsExplorerFilters();
    const orderedRows = filterAndSortFindingRows(rows, filters);
    const csv = createFindingsCsv(orderedRows);

    expect(orderedRows.map((row) => row.finding.id)).toEqual([
      "breaking-item",
      "safe-item",
    ]);
    expect(csv).toContain(
      '"Severity","Ignored","Ignored By","Change","Endpoint/Schema","Rule","Category"',
    );
    expect(csv).toContain('"breaking","no","","Response removed"');
  });

  it("keeps ignored findings exportable when the caller includes them", () => {
    const report = createReport([
      createFinding("active-item", {
        category: "response",
        message: "Breaking change.",
        ruleId: "response.status.removed",
        severity: "breaking",
        title: "Response removed",
      }),
      createFinding("ignored-item", {
        category: "operation",
        ignored: true,
        ignoredBy: [
          {
            id: "ruleId:operationId.changed",
            label: "Rule operationId.changed",
            reason: "Ignore SDK-only rename churn.",
            source: "ruleId",
          },
        ],
        message: "operationId changed from listUsers to fetchUsers.",
        operationId: "fetchUsers",
        ruleId: "operationId.changed",
        severity: "dangerous",
        title: "Operation ID changed",
      }),
    ]);
    const rows = createReportFindingRows(report);
    const activeRows = rows.filter((row) => !row.finding.ignored);
    const allRows = rows;
    const activeCsv = createFindingsCsv(activeRows);
    const allCsv = createFindingsCsv(allRows);
    const markdown = createReportMarkdown(report, allRows);

    expect(activeCsv).not.toContain('"Operation ID changed"');
    expect(allCsv).toContain('"yes","Rule operationId.changed","Operation ID changed"');
    expect(markdown).toContain("- Ignored findings: 1");
    expect(markdown).toContain("Ignored by: Rule operationId.changed");
  });

  it("escapes HTML export content so report text cannot inject markup", () => {
    const report = createReport([
      createFinding("html-item", {
        category: "response",
        message: "<script>alert('xss')</script>",
        ruleId: "response.status.removed",
        severity: "breaking",
        title: "<b>Response removed</b>",
      }),
    ]);
    const rows = createReportFindingRows(report);
    const html = createReportHtml(report, rows);

    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;Response removed&lt;/b&gt;");
    expect(html).not.toContain("<script>alert('xss')</script>");
  });
});

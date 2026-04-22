import { describe, expect, it } from "vitest";
import {
  createDefaultFindingsExplorerFilters,
  createFindingsCsv,
  createReportFindingRows,
  filterAndSortFindingRows,
} from "@/features/openapi-diff/lib/report-explorer";
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
  return {
    affectedEndpoints: [
      {
        findingCount: findings.length,
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
    settings: {
      consumerProfile: "publicApi",
      exportFormats: [],
      failOnSeverities: ["breaking"],
      ignoreRules: [],
      includeCategories: [
        "docs",
        "enum",
        "metadata",
        "operation",
        "parameter",
        "path",
        "requestBody",
        "response",
        "schema",
        "security",
      ],
      includeInfoFindings: true,
      redactExamples: false,
      resolveLocalRefs: true,
    },
    successState: null,
    summary: {
      byCategory: {
        docs: 0,
        operations: 1,
        parameters: 0,
        paths: 0,
        responses: 0,
        schemas: 1,
        security: 1,
      },
      bySeverity: {
        breaking: 1,
        dangerous: 1,
        info: 0,
        safe: 1,
      },
      ignoredFindings: 0,
      totalFindings: findings.length,
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
    expect(csv).toContain('"Severity","Change","Endpoint/Schema","Rule","Category"');
    expect(csv).toContain('"breaking","Response removed"');
  });
});

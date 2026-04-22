import { describe, expect, it } from "vitest";
import { buildReport } from "@/features/openapi-diff/engine/report";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import type { DiffFinding, ParsedSpec } from "@/features/openapi-diff/types";

function createParsedSpec(label: string): ParsedSpec {
  return {
    byteCount: 256,
    componentsOnly: false,
    externalRefCount: 0,
    input: {
      format: "yaml",
      id: label.toLowerCase(),
      label,
      source: "sample",
    },
    lineCount: 12,
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
  const baseFinding: DiffFinding = {
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
  };

  return {
    ...baseFinding,
    ...overrides,
  };
}

describe("buildReport", () => {
  it("returns Block release when breaking findings exist", () => {
    const report = buildReport(
      createParsedSpec("Base spec"),
      createParsedSpec("Revision spec"),
      [
        createFinding("breaking-1", {
          baseSeverity: "breaking",
          category: "path",
          jsonPointer: "#/paths/~1legacy",
          message: "The /legacy path was removed.",
          method: null,
          path: "/legacy",
          ruleId: "path.removed",
          severity: "breaking",
          severityReason: "Existing clients can still call this endpoint.",
          title: "Path removed",
          whyItMatters: "Removed endpoints break existing callers.",
        }),
      ],
      createAnalysisSettings(),
      {
        generatedAt: "2026-04-22T00:00:00.000Z",
      },
    );

    expect(report.recommendation.label).toBe("Block release");
    expect(report.riskScore).toBeGreaterThan(0);
    expect(report.successState).toBeNull();
  });

  it("returns Review before release when only dangerous findings exist", () => {
    const report = buildReport(
      createParsedSpec("Base spec"),
      createParsedSpec("Revision spec"),
      [
        createFinding("dangerous-1", {
          baseSeverity: "dangerous",
          category: "metadata",
          message: "operationId changed from listUsers to fetchUsers.",
          ruleId: "operationId.changed",
          severity: "dangerous",
          severityReason: "Generated SDK entry points may change.",
          title: "Operation ID changed",
          whyItMatters: "SDK generators can treat operationId as stable API surface.",
        }),
      ],
      createAnalysisSettings(),
    );

    expect(report.recommendation.label).toBe("Review before release");
    expect(report.successState).toMatchObject({
      emphasis: "info",
      title: "No breaking changes found",
    });
  });

  it("returns Likely safe when only safe findings exist", () => {
    const report = buildReport(
      createParsedSpec("Base spec"),
      createParsedSpec("Revision spec"),
      [
        createFinding("safe-1", {
          baseSeverity: "safe",
          category: "schema",
          humanPath: "GET /users response 200 application/json User.nickname",
          jsonPointer: "#/components/schemas/User/properties/nickname",
          message: "User.nickname was added as an optional property.",
          ruleId: "schema.property.added.optional",
          severity: "safe",
          severityReason: "Additive response fields are safe for this profile.",
          title: "Optional property added",
          whyItMatters: "Tolerant clients can usually ignore extra properties.",
        }),
      ],
      createAnalysisSettings(),
    );

    expect(report.recommendation.label).toBe("Likely safe");
    expect(report.successState).toMatchObject({
      emphasis: "success",
      title: "No breaking changes found",
    });
  });

  it("returns a zero-count success state for an empty diff", () => {
    const report = buildReport(
      createParsedSpec("Base spec"),
      createParsedSpec("Revision spec"),
      [],
      createAnalysisSettings(),
    );

    expect(report.summary.bySeverity).toEqual({
      breaking: 0,
      dangerous: 0,
      info: 0,
      safe: 0,
    });
    expect(report.summary.byCategory).toEqual({
      docs: 0,
      operations: 0,
      parameters: 0,
      paths: 0,
      responses: 0,
      schemas: 0,
      security: 0,
    });
    expect(report.summary.totalFindings).toBe(0);
    expect(report.riskScore).toBe(0);
    expect(report.recommendation.label).toBe("Likely safe");
    expect(report.successState).toMatchObject({
      emphasis: "success",
      message: "No semantic contract changes were detected in the current comparison.",
      title: "No breaking changes found",
    });
  });

  it("dedupes affected endpoints and schemas", () => {
    const report = buildReport(
      createParsedSpec("Base spec"),
      createParsedSpec("Revision spec"),
      [
        createFinding("schema-1", {
          baseSeverity: "breaking",
          category: "schema",
          humanPath: "User.status",
          jsonPointer: "#/components/schemas/User/properties/status",
          message: "User.status changed type.",
          ruleId: "schema.type.changed",
          severity: "breaking",
          severityReason: "Type changes break clients.",
          title: "Schema type changed",
          whyItMatters: "Generated models and validators can fail.",
        }),
        createFinding("schema-2", {
          baseSeverity: "dangerous",
          category: "enum",
          humanPath: "User.status",
          jsonPointer: "#/components/schemas/User/properties/status/enum",
          message: "User.status added a new enum value.",
          ruleId: "schema.enum.value.added",
          severity: "dangerous",
          severityReason: "Strict clients may reject a new enum value.",
          title: "Enum value added",
          whyItMatters: "Closed enums need regeneration.",
        }),
        createFinding("endpoint-1", {
          baseSeverity: "breaking",
          category: "response",
          jsonPointer: "#/paths/~1users/get/responses/200",
          message: "GET /users removed the 200 response.",
          ruleId: "response.status.removed",
          severity: "breaking",
          severityReason: "Clients expect that success response.",
          title: "Response status removed",
          whyItMatters: "Removing a documented response can break callers.",
        }),
        createFinding("endpoint-2", {
          baseSeverity: "dangerous",
          category: "security",
          jsonPointer: "#/paths/~1users/get/security",
          message: "GET /users added an OAuth scope.",
          ruleId: "security.scope.added",
          severity: "dangerous",
          severityReason: "Clients may need new auth permissions.",
          title: "Security scope added",
          whyItMatters: "New scopes can block existing tokens.",
        }),
      ],
      createAnalysisSettings(),
    );

    expect(report.affectedEndpoints).toHaveLength(1);
    expect(report.affectedEndpoints[0]).toMatchObject({
      findingCount: 4,
      highestSeverity: "breaking",
      method: "get",
      path: "/users",
    });
    expect(report.affectedSchemas).toHaveLength(1);
    expect(report.affectedSchemas[0]).toMatchObject({
      findingCount: 2,
      highestSeverity: "breaking",
      label: "User",
    });
  });
});

import { describe, expect, it } from "vitest";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import {
  createFeedbackText,
  createOpenApiDiffFeedbackPayload,
  looksLikeRawSpecContent,
  normalizeFeedbackEmail,
} from "@/features/openapi-diff/lib/feedback";
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
      url: `https://${label.toLowerCase().replace(/\s+/g, "-")}.private.example.com/openapi.yaml`,
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

function createFinding(id: string, overrides: Partial<DiffFinding> = {}): DiffFinding {
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
    affectedSchemas: [],
    baseline: createParsedSpec("Base Spec"),
    candidate: createParsedSpec("Revision Spec"),
    executiveSummary: "Summary",
    findings,
    generatedAt: "2026-04-23T00:00:00.000Z",
    migrationNotes: [],
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
    topReviewItems: [],
    warnings: [],
  };
}

describe("openapi diff feedback", () => {
  it("builds safe correctness feedback without attaching spec URLs or raw report content", () => {
    const report = createReport([
      createFinding("response-removed", {
        message: "GET /users removed the 200 response.",
      }),
    ]);
    const payload = createOpenApiDiffFeedbackPayload({
      includeReportMetadata: true,
      kind: "correctness",
      message: "The breaking count looks too high for this sample.",
      rating: 2,
      report,
    });
    const serialized = JSON.stringify(payload);

    expect(payload.reportMetadata).toMatchObject({
      recommendation: "blockRelease",
      riskScore: 84,
      totalFindings: 1,
    });
    expect(serialized).not.toContain("private.example.com");
    expect(serialized).not.toContain("GET /users removed the 200 response.");
  });

  it("prepares readable fallback text for copy or email delivery", () => {
    const payload = createOpenApiDiffFeedbackPayload({
      email: "reviewer@example.com",
      includeReportMetadata: false,
      kind: "idea",
      message: "A saved comparison history would help repeat reviews.",
      rating: 4,
      report: null,
    });
    const text = createFeedbackText(payload);

    expect(text).toContain("Authos OpenAPI Diff feedback");
    expect(text).toContain("Type: Idea");
    expect(text).toContain("reviewer@example.com");
    expect(text).toContain("A saved comparison history would help repeat reviews.");
  });

  it("flags likely raw spec pastes and validates optional email addresses", () => {
    expect(
      looksLikeRawSpecContent(`openapi: 3.1.0\ninfo:\n  title: Demo\npaths:\n  /users:\n    get:\n      responses:\n        "200":\n          description: ok\ncomponents:\n  schemas: {}`),
    ).toBe(true);
    expect(looksLikeRawSpecContent("The result looks off when I compare the sample.")).toBe(
      false,
    );
    expect(normalizeFeedbackEmail(" reviewer@example.com ")).toBe("reviewer@example.com");
    expect(normalizeFeedbackEmail("not-an-email")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { reclassifyDiffReport } from "@/features/openapi-diff/engine/classify";
import { buildOpenApiDiffReport } from "@/features/openapi-diff/engine/diff";
import { normalizeOpenApiDocument } from "@/features/openapi-diff/engine/normalize";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import {
  createPathPatternIgnoreRule,
  createRuleIdIgnoreRule,
} from "@/features/openapi-diff/lib/ignore-rules";
import { parseOpenApiSpec } from "@/features/openapi-diff/lib/parser";
import type {
  ConsumerProfile,
  DiffFinding,
  DiffReport,
  RuleId,
  SpecInput,
} from "@/features/openapi-diff/types";

function createSpecInput(
  id: SpecInput["id"],
  content: string,
  format: SpecInput["format"] = "yaml",
): SpecInput {
  return {
    content,
    format,
    id,
    label: id === "base" ? "Base spec" : "Revision spec",
    source: "sample",
  };
}

async function buildReport(
  baseContent: string,
  revisionContent: string,
  consumerProfile: ConsumerProfile = "publicApi",
): Promise<DiffReport> {
  const baseParsed = await parseOpenApiSpec(createSpecInput("base", baseContent));
  const revisionParsed = await parseOpenApiSpec(createSpecInput("revision", revisionContent));

  expect(baseParsed.ok).toBe(true);
  expect(revisionParsed.ok).toBe(true);

  if (!baseParsed.ok || !revisionParsed.ok) {
    throw new Error("Expected both specs to parse before diffing.");
  }

  return buildOpenApiDiffReport({
    baseModel: normalizeOpenApiDocument(baseParsed.parsed, baseParsed.document).model,
    baseline: baseParsed.parsed,
    candidate: revisionParsed.parsed,
    generatedAt: "2026-04-22T00:00:00.000Z",
    revisionModel: normalizeOpenApiDocument(revisionParsed.parsed, revisionParsed.document).model,
    settings: createAnalysisSettings({ consumerProfile }),
  });
}

function getFinding(report: DiffReport, ruleId: RuleId): DiffFinding {
  const finding = report.findings.find((entry) => entry.ruleId === ruleId);

  expect(finding).toBeDefined();

  if (!finding) {
    throw new Error(`Expected finding ${ruleId} to exist.`);
  }

  return finding;
}

describe("compatibility profile classification", () => {
  it("classifies response enum additions differently per consumer profile", async () => {
    const baseSpec = `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum:
                      - active
`;
    const revisionSpec = `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum:
                      - active
                      - paused
`;

    const publicReport = await buildReport(baseSpec, revisionSpec, "publicApi");
    const sdkStrictReport = await buildReport(baseSpec, revisionSpec, "sdkStrict");
    const tolerantReport = await buildReport(baseSpec, revisionSpec, "tolerantClient");

    const publicFinding = getFinding(publicReport, "schema.enum.value.added");
    const sdkStrictFinding = getFinding(sdkStrictReport, "schema.enum.value.added");
    const tolerantFinding = getFinding(tolerantReport, "schema.enum.value.added");

    expect(publicFinding.id).toBe(sdkStrictFinding.id);
    expect(publicFinding.id).toBe(tolerantFinding.id);
    expect(publicFinding.severity).toBe("dangerous");
    expect(sdkStrictFinding.severity).toBe("breaking");
    expect(tolerantFinding.severity).toBe("safe");
    expect(sdkStrictFinding.severityReason).toContain("SDK strict");
    expect(publicFinding.severityReason).not.toBe(sdkStrictFinding.severityReason);
  });

  it("changes operationId severity and explanation by profile", async () => {
    const baseSpec = `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        "200":
          description: ok
`;
    const revisionSpec = `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      operationId: fetchUsers
      responses:
        "200":
          description: ok
`;

    const publicReport = await buildReport(baseSpec, revisionSpec, "publicApi");
    const internalReport = await buildReport(baseSpec, revisionSpec, "internalApi");
    const sdkStrictReport = await buildReport(baseSpec, revisionSpec, "sdkStrict");

    const publicFinding = getFinding(publicReport, "operationId.changed");
    const internalFinding = getFinding(internalReport, "operationId.changed");
    const sdkStrictFinding = getFinding(sdkStrictReport, "operationId.changed");

    expect(publicFinding.id).toBe(internalFinding.id);
    expect(publicFinding.id).toBe(sdkStrictFinding.id);
    expect(publicFinding.severity).toBe("dangerous");
    expect(internalFinding.severity).toBe("info");
    expect(sdkStrictFinding.severity).toBe("dangerous");
    expect(internalFinding.severityReason).toContain("Internal API");
    expect(sdkStrictFinding.severityReason).toContain("SDK strict");
    expect(publicFinding.severityReason).not.toBe(internalFinding.severityReason);
  });

  it("raises additive response fields for stricter decoders", async () => {
    const baseSpec = `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                required:
                  - id
                properties:
                  id:
                    type: string
`;
    const revisionSpec = `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                required:
                  - id
                properties:
                  id:
                    type: string
                  nickname:
                    type: string
`;

    const publicReport = await buildReport(baseSpec, revisionSpec, "publicApi");
    const sdkStrictReport = await buildReport(baseSpec, revisionSpec, "sdkStrict");
    const tolerantReport = await buildReport(baseSpec, revisionSpec, "tolerantClient");

    const publicFinding = getFinding(publicReport, "schema.property.added.optional");
    const sdkStrictFinding = getFinding(sdkStrictReport, "schema.property.added.optional");
    const tolerantFinding = getFinding(tolerantReport, "schema.property.added.optional");

    expect(publicFinding.severity).toBe("safe");
    expect(sdkStrictFinding.severity).toBe("dangerous");
    expect(tolerantFinding.severity).toBe("info");
    expect(tolerantFinding.severityReason).toContain("tolerant client profile");
  });

  it("keeps added required query parameters breaking for every profile", async () => {
    const baseSpec = `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
`;
    const revisionSpec = `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      parameters:
        - in: query
          name: region
          required: true
          schema:
            type: string
      responses:
        "200":
          description: ok
`;

    const profiles: ConsumerProfile[] = [
      "publicApi",
      "internalApi",
      "sdkStrict",
      "mobileClient",
      "tolerantClient",
    ];

    for (const consumerProfile of profiles) {
      const report = await buildReport(baseSpec, revisionSpec, consumerProfile);
      const finding = getFinding(report, "parameter.required.added");

      expect(report.settings.consumerProfile).toBe(consumerProfile);
      expect(finding.severity).toBe("breaking");
      expect(finding.severityReason).toContain("All profiles keep this at breaking");
    }
  });

  it("reclassifies reports deterministically without mutating the original report", async () => {
    const baseSpec = `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
`;
    const revisionSpec = `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  nickname:
                    type: string
`;

    const publicReport = await buildReport(baseSpec, revisionSpec, "publicApi");
    const sdkStrictSettings = createAnalysisSettings({ consumerProfile: "sdkStrict" });
    const firstSdkStrictReport = reclassifyDiffReport(publicReport, sdkStrictSettings);
    const secondSdkStrictReport = reclassifyDiffReport(publicReport, sdkStrictSettings);

    expect(firstSdkStrictReport).toEqual(secondSdkStrictReport);
    expect(publicReport.settings.consumerProfile).toBe("publicApi");
    expect(firstSdkStrictReport.settings.consumerProfile).toBe("sdkStrict");
    expect(firstSdkStrictReport.findings.map((finding) => finding.id)).toEqual(
      publicReport.findings.map((finding) => finding.id),
    );
    expect(getFinding(publicReport, "schema.property.added.optional").severity).toBe("safe");
    expect(getFinding(firstSdkStrictReport, "schema.property.added.optional").severity).toBe(
      "dangerous",
    );
  });

  it("moves path-matched findings into the ignored bucket without deleting them", async () => {
    const baseSpec = `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /internal/users:
    get:
      responses:
        "200":
          description: ok
`;
    const revisionSpec = `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /internal/users:
    get:
      parameters:
        - in: query
          name: region
          required: true
          schema:
            type: string
      responses:
        "200":
          description: ok
`;

    const baseReport = await buildReport(baseSpec, revisionSpec, "publicApi");
    const ignoredReport = reclassifyDiffReport(
      baseReport,
      createAnalysisSettings({
        consumerProfile: "publicApi",
        ignoreRules: [createPathPatternIgnoreRule("/internal/*")],
      }),
    );

    expect(baseReport.summary.totalFindings).toBe(1);
    expect(baseReport.summary.ignoredFindings).toBe(0);
    expect(ignoredReport.summary.totalFindings).toBe(0);
    expect(ignoredReport.summary.ignoredFindings).toBe(1);
    expect(ignoredReport.findings).toHaveLength(1);
    const ignoredFinding = ignoredReport.findings[0];

    expect(ignoredFinding).toBeDefined();

    if (!ignoredFinding) {
      throw new Error("Expected ignored finding to exist.");
    }

    expect(ignoredFinding).toMatchObject({
      ignored: true,
      path: "/internal/users",
      ruleId: "parameter.required.added",
    });
    expect(ignoredFinding.ignoredBy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pathPattern:/internal/*",
          label: "Path /internal/*",
          source: "pathPattern",
        }),
      ]),
    );
  });

  it("moves rule-matched findings into the ignored bucket without changing others", async () => {
    const baseSpec = `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        "200":
          description: ok
`;
    const revisionSpec = `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      operationId: fetchUsers
      responses:
        "200":
          description: ok
`;

    const baseReport = await buildReport(baseSpec, revisionSpec, "publicApi");
    const ignoredReport = reclassifyDiffReport(
      baseReport,
      createAnalysisSettings({
        consumerProfile: "publicApi",
        ignoreRules: [createRuleIdIgnoreRule("operationId.changed")],
      }),
    );

    expect(baseReport.summary.totalFindings).toBe(1);
    expect(ignoredReport.summary.totalFindings).toBe(0);
    expect(ignoredReport.summary.ignoredFindings).toBe(1);
    const ignoredFinding = ignoredReport.findings[0];

    expect(ignoredFinding).toBeDefined();

    if (!ignoredFinding) {
      throw new Error("Expected ignored finding to exist.");
    }

    expect(ignoredFinding).toMatchObject({
      ignored: true,
      ruleId: "operationId.changed",
      severity: "dangerous",
    });
    expect(ignoredFinding.ignoredBy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ruleId:operationId.changed",
          label: "Rule operationId.changed",
          source: "ruleId",
        }),
      ]),
    );
  });
});

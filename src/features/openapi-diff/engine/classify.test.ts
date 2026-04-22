import { describe, expect, it } from "vitest";
import { buildOpenApiDiffReport } from "@/features/openapi-diff/engine/diff";
import { normalizeOpenApiDocument } from "@/features/openapi-diff/engine/normalize";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import { parseOpenApiSpec } from "@/features/openapi-diff/lib/parser";
import type { ConsumerProfile, SpecInput } from "@/features/openapi-diff/types";

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
  consumerProfile: ConsumerProfile,
) {
  const [baseParsed, revisionParsed] = await Promise.all([
    parseOpenApiSpec(createSpecInput("base", baseContent)),
    parseOpenApiSpec(createSpecInput("revision", revisionContent)),
  ]);

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

describe("compatibility profiles", () => {
  it("classifies an added response enum value differently across profiles", async () => {
    const base = `openapi: 3.1.0
info:
  title: Enum Profile Test
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
    const revision = `openapi: 3.1.0
info:
  title: Enum Profile Test
  version: 1.1.0
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
                      - archived
`;

    const [publicReport, sdkReport, tolerantReport] = await Promise.all([
      buildReport(base, revision, "publicApi"),
      buildReport(base, revision, "sdkStrict"),
      buildReport(base, revision, "tolerantClient"),
    ]);

    const publicFinding = publicReport.findings.find(
      (finding) => finding.ruleId === "schema.enum.value.added",
    );
    const sdkFinding = sdkReport.findings.find(
      (finding) => finding.ruleId === "schema.enum.value.added",
    );
    const tolerantFinding = tolerantReport.findings.find(
      (finding) => finding.ruleId === "schema.enum.value.added",
    );

    expect(publicFinding?.severity).toBe("dangerous");
    expect(sdkFinding?.severity).toBe("breaking");
    expect(tolerantFinding?.severity).toBe("safe");
    expect(sdkFinding?.severityReason).toContain("SDK strict");
    expect(publicReport.settings.consumerProfile).toBe("publicApi");
    expect(publicReport.findings.map((finding) => finding.id)).toEqual(
      sdkReport.findings.map((finding) => finding.id),
    );
  });

  it("downgrades operationId changes for internal APIs but keeps SDK strict conservative", async () => {
    const base = `openapi: 3.1.0
info:
  title: Operation Id Test
  version: 1.0.0
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        "200":
          description: ok
`;
    const revision = `openapi: 3.1.0
info:
  title: Operation Id Test
  version: 1.1.0
paths:
  /users:
    get:
      operationId: fetchUsers
      responses:
        "200":
          description: ok
`;

    const [publicReport, internalReport, sdkReport] = await Promise.all([
      buildReport(base, revision, "publicApi"),
      buildReport(base, revision, "internalApi"),
      buildReport(base, revision, "sdkStrict"),
    ]);

    expect(
      publicReport.findings.find((finding) => finding.ruleId === "operationId.changed")
        ?.severity,
    ).toBe("dangerous");
    expect(
      internalReport.findings.find((finding) => finding.ruleId === "operationId.changed")
        ?.severity,
    ).toBe("info");
    expect(
      sdkReport.findings.find((finding) => finding.ruleId === "operationId.changed")
        ?.severity,
    ).toBe("dangerous");
  });

  it("treats additive response properties as more serious for strict SDK consumers", async () => {
    const base = `openapi: 3.1.0
info:
  title: Response Shape Test
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
    const revision = `openapi: 3.1.0
info:
  title: Response Shape Test
  version: 1.1.0
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

    const [publicReport, sdkReport] = await Promise.all([
      buildReport(base, revision, "publicApi"),
      buildReport(base, revision, "sdkStrict"),
    ]);

    expect(
      publicReport.findings.find(
        (finding) => finding.ruleId === "schema.property.added.optional",
      )?.severity,
    ).toBe("safe");
    expect(
      sdkReport.findings.find(
        (finding) => finding.ruleId === "schema.property.added.optional",
      )?.severity,
    ).toBe("dangerous");
  });

  it("keeps required query parameter additions breaking for every profile", async () => {
    const base = `openapi: 3.1.0
info:
  title: Required Parameter Test
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
`;
    const revision = `openapi: 3.1.0
info:
  title: Required Parameter Test
  version: 1.1.0
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

    for (const profile of [
      "publicApi",
      "internalApi",
      "sdkStrict",
      "mobileClient",
      "tolerantClient",
    ] as const satisfies readonly ConsumerProfile[]) {
      const report = await buildReport(base, revision, profile);
      const finding = report.findings.find(
        (entry) => entry.ruleId === "parameter.required.added",
      );

      expect(finding?.severity).toBe("breaking");
      expect(finding?.severityReason).toContain("breaking");
    }
  });

  it("adds a severity reason to every finding", async () => {
    const report = await buildReport(
      `openapi: 3.1.0
info:
  title: Mixed Finding Test
  version: 1.0.0
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        "200":
          description: ok
`,
      `openapi: 3.1.0
info:
  title: Mixed Finding Test
  version: 1.1.0
paths:
  /users:
    get:
      operationId: fetchUsers
      responses:
        "200":
          description: ok
`,
      "internalApi",
    );

    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.every((finding) => finding.severityReason.trim().length > 0)).toBe(
      true,
    );
  });
});

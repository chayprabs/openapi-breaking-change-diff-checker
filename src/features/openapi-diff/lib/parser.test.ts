import { describe, expect, it } from "vitest";
import {
  baseSampleOpenApi31,
  malformedYamlSample,
  revisionSampleOpenApi31,
  unresolvedRefSample,
} from "@/features/openapi-diff/fixtures";
import {
  analyzeOpenApiSpecs,
  parseOpenApiSpec,
} from "@/features/openapi-diff/lib/parser";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import type { SpecInput } from "@/features/openapi-diff/types";

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

describe("OpenAPI parser", () => {
  it("parses a valid OpenAPI 3.1 sample", async () => {
    const result = await parseOpenApiSpec(createSpecInput("base", baseSampleOpenApi31));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.parsed.version.family).toBe("openapi-3.1.x");
    expect(result.parsed.pathCount).toBe(2);
    expect(result.parsed.schemaCount).toBe(1);
    expect(result.parsed.localRefCount).toBeGreaterThan(0);
    expect(result.parsed.unresolvedRefs).toEqual([]);
  });

  it("returns YAML line and column details for malformed input", async () => {
    const result = await parseOpenApiSpec(
      createSpecInput("revision", malformedYamlSample),
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.errors[0]?.line).toBeGreaterThan(0);
    expect(result.errors[0]?.column).toBeGreaterThan(0);
    expect(result.errors[0]?.message.length).toBeGreaterThan(10);
  });

  it("warns on unsupported versions instead of crashing", async () => {
    const unsupportedVersionSpec = `openapi: 9.0.0
info:
  title: Future API
  version: 1.0.0
paths: {}`;
    const result = await parseOpenApiSpec(
      createSpecInput("base", unsupportedVersionSpec),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.parsed.version.family).toBe("unknown");
    expect(
      result.parsed.warnings.some((warning) => warning.code === "unsupported-version"),
    ).toBe(true);
  });

  it("reports unresolved refs as warnings", async () => {
    const result = await parseOpenApiSpec(
      createSpecInput("base", unresolvedRefSample),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.parsed.unresolvedRefs).toEqual([
      "#/components/schemas/MissingAccountList",
    ]);
    expect(
      result.parsed.warnings.some((warning) => warning.code === "unresolved-ref"),
    ).toBe(true);
  });

  it("analyzes two valid specs without failing the worker-facing parser flow", async () => {
    const result = await analyzeOpenApiSpecs(
      createSpecInput("base", baseSampleOpenApi31),
      createSpecInput("revision", revisionSampleOpenApi31),
      {
        settings: createAnalysisSettings({ consumerProfile: "sdkStrict" }),
      },
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.result.base.pathCount).toBe(2);
    expect(result.result.revision.pathCount).toBe(1);
    expect(["lightweight", "scalar"]).toContain(result.result.validationSource);
    expect(result.result.report.settings.consumerProfile).toBe("sdkStrict");
    expect(result.result.report.findings.length).toBeGreaterThan(0);
    expect(
      result.result.report.findings.every((finding) => finding.severityReason.length > 0),
    ).toBe(true);
    expect(result.result.report.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "parameter.required.added",
        "request.body.required.added",
        "response.status.removed",
        "response.mediaType.removed",
        "path.removed",
      ]),
    );
  });
});

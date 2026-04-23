import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import { analyzeOpenApiSpecs } from "@/features/openapi-diff/lib/parser";
import { createSpecInput } from "@/features/openapi-diff/test-support/openapi-diff-test-harness";
import type { AnalysisSettings } from "@/features/openapi-diff/types";

const GOLDENS_ROOT = fileURLToPath(new URL("./", import.meta.url));
const REQUIRED_SCENARIOS = [
  "required-parameter-added",
  "removed-endpoint",
  "removed-response-property",
  "schema-type-changed",
  "enum-value-removed",
  "enum-value-added-sdk-strict",
  "auth-scope-added",
  "docs-only-changes",
  "local-refs",
  "invalid-yaml",
] as const;
const scenarioDirectories = readdirSync(GOLDENS_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

describe("OpenAPI golden scenarios", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T00:00:00.000Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("stores the required fixture scenarios on disk", () => {
    expect(scenarioDirectories).toEqual(
      expect.arrayContaining([...REQUIRED_SCENARIOS]),
    );
    expect(scenarioDirectories.length).toBeGreaterThanOrEqual(10);
  });

  for (const scenarioName of scenarioDirectories) {
    it(`${scenarioName} matches its expected snapshot`, async () => {
      const scenarioRoot = join(GOLDENS_ROOT, scenarioName);
      const baseContent = readFileSync(join(scenarioRoot, "base.yaml"), "utf8");
      const revisionContent = readFileSync(join(scenarioRoot, "revision.yaml"), "utf8");
      const settings = readScenarioSettings(scenarioRoot);
      const expectedPath = join(scenarioRoot, "expected.json");
      const result = await analyzeOpenApiSpecs(
        createSpecInput("base", baseContent, {
          filename: `${scenarioName}.base.yaml`,
        }),
        createSpecInput("revision", revisionContent, {
          filename: `${scenarioName}.revision.yaml`,
        }),
        {
          settings,
        },
      );
      const serialized = serializeGoldenResult(result);

      if (process.env.UPDATE_GOLDENS === "1") {
        writeFileSync(expectedPath, serialized);
      }

      if (!existsSync(expectedPath)) {
        throw new Error(
          `Missing expected snapshot for ${scenarioName}. Run with UPDATE_GOLDENS=1 to create it.`,
        );
      }

      expect(serialized).toBe(readFileSync(expectedPath, "utf8"));
    });
  }
});

function readScenarioSettings(scenarioRoot: string): AnalysisSettings {
  const settingsPath = join(scenarioRoot, "settings.json");

  if (!existsSync(settingsPath)) {
    return createAnalysisSettings();
  }

  return createAnalysisSettings(
    JSON.parse(readFileSync(settingsPath, "utf8")) as Partial<AnalysisSettings>,
  );
}

function serializeGoldenResult(
  result: Awaited<ReturnType<typeof analyzeOpenApiSpecs>>,
) {
  if (!result.ok) {
    return JSON.stringify(
      {
        errors: result.errors,
        ok: false,
        warnings: result.warnings,
      },
      null,
      2,
    ).concat("\n");
  }

  return JSON.stringify(
    {
      ok: true,
      validationSource: result.result.validationSource,
      warnings: result.result.warnings,
      report: result.result.report,
    },
    null,
    2,
  ).concat("\n");
}

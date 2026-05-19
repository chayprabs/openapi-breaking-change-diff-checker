import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ruleIds } from "@/features/openapi-diff/types";

const GOLDENS_ROOT = fileURLToPath(new URL("../goldens", import.meta.url));
const FEATURE_ROOT = fileURLToPath(new URL("..", import.meta.url));

function collectGoldenRuleIds() {
  const covered = new Set<string>();

  for (const scenario of readdirSync(GOLDENS_ROOT, { withFileTypes: true })) {
    if (!scenario.isDirectory()) {
      continue;
    }

    const expectedPath = join(GOLDENS_ROOT, scenario.name, "expected.json");

    if (!existsSync(expectedPath)) {
      continue;
    }

    const content = readFileSync(expectedPath, "utf8");

    for (const ruleId of ruleIds) {
      if (content.includes(`"${ruleId}"`)) {
        covered.add(ruleId);
      }
    }
  }

  return covered;
}

function collectTestMentionedRuleIds() {
  const covered = new Set<string>();

  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory() && entry.name !== "goldens") {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".ts")) {
        const content = readFileSync(fullPath, "utf8");

        for (const ruleId of ruleIds) {
          if (content.includes(ruleId)) {
            covered.add(ruleId);
          }
        }
      }
    }
  };

  walk(FEATURE_ROOT);
  return covered;
}

describe("rule catalog coverage", () => {
  it("references every rule id in a golden snapshot or test file", () => {
    const golden = collectGoldenRuleIds();
    const tests = collectTestMentionedRuleIds();
    const uncovered = ruleIds.filter((ruleId) => !golden.has(ruleId) && !tests.has(ruleId));

    expect(uncovered, uncovered.join(", ")).toEqual([]);
  });
});

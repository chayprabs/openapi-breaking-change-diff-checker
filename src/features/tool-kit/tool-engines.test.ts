import { describe, expect, it } from "vitest";
import { diffGraphqlSchemas } from "@/features/graphql-schema-guard/lib/diff-graphql";
import { diffJsonSchemas } from "@/features/json-schema-guard/lib/diff-json-schema";
import { diffSqlMigrations } from "@/features/sql-migration-guard/lib/diff-sql";
import { diffYamlConfigs } from "@/features/yaml-config-diff/lib/diff-yaml-config";

describe("tool kit engines", () => {
  it("detects graphql field removals", () => {
    const result = diffGraphqlSchemas(
      `type User { id: ID! name: String! }`,
      `type User { id: ID! email: String! }`,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.findings.some((finding) => finding.severity === "breaking")).toBe(true);
    }
  });

  it("detects json schema required field drift", () => {
    const result = diffJsonSchemas(
      JSON.stringify({ type: "object", properties: { id: { type: "string" } } }),
      JSON.stringify({
        type: "object",
        required: ["email"],
        properties: { email: { type: "string" } },
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.findings.length).toBeGreaterThan(0);
    }
  });

  it("detects yaml key removals", () => {
    const result = diffYamlConfigs("jobs:\n  test: true", "jobs:\n  build: true");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.findings.length).toBeGreaterThan(0);
    }
  });

  it("flags destructive sql", () => {
    const result = diffSqlMigrations("", "DROP TABLE users;");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.findings.some((finding) => finding.severity === "breaking")).toBe(true);
    }
  });
});

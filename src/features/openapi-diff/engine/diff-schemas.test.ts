import { describe, expect, it } from "vitest";
import { diffSchemas } from "@/features/openapi-diff/engine/diff-schemas";
import { normalizeOpenApiDocument } from "@/features/openapi-diff/engine/normalize";
import { parseOpenApiSpec } from "@/features/openapi-diff/lib/parser";
import type { NormalizedSchema, SpecInput } from "@/features/openapi-diff/types";

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

function createComponentSpec(schemaBlock: string) {
  return `openapi: 3.1.0
info:
  title: Schema Diff Test
  version: 1.0.0
paths: {}
components:
  schemas:
${indentBlock(schemaBlock, 4)}
`;
}

async function loadComponentSchema(content: string, schemaName = "User") {
  const parsed = await parseOpenApiSpec(createSpecInput("base", createComponentSpec(content)));

  expect(parsed.ok).toBe(true);

  if (!parsed.ok) {
    throw new Error("Expected the schema fixture to parse successfully.");
  }

  const normalized = normalizeOpenApiDocument(parsed.parsed, parsed.document).model;

  return normalized.components.schemas[`#/components/schemas/${schemaName}`];
}

async function diffComponentSchemas(
  baseContent: string,
  revisionContent: string,
  schemaName = "User",
) {
  const [baseSchema, revisionSchema] = await Promise.all([
    loadComponentSchema(baseContent, schemaName),
    loadComponentSchema(revisionContent, schemaName),
  ]);

  expect(baseSchema).toBeDefined();
  expect(revisionSchema).toBeDefined();

  return diffSchemas({
    baseSchema: baseSchema as NormalizedSchema,
    direction: "component",
    revisionSchema: revisionSchema as NormalizedSchema,
  });
}

describe("diffSchemas", () => {
  it("reports a required property added", async () => {
    const findings = await diffComponentSchemas(
      `User:
  type: object
  properties:
    status:
      type: string
`,
      `User:
  type: object
  required:
    - status
  properties:
    status:
      type: string
`,
    );
    const finding = findings.find((entry) => entry.ruleId === "schema.required.added");

    expect(finding).toMatchObject({
      afterValue: true,
      beforeValue: false,
      humanPath: "User.status",
      jsonPointer: "#/components/schemas/User/properties/status",
      ruleId: "schema.required.added",
      severity: "breaking",
      title: "User.status: required property added",
    });
  });

  it("reports a removed property", async () => {
    const findings = await diffComponentSchemas(
      `User:
  type: object
  properties:
    nickname:
      type: string
`,
      `User:
  type: object
  properties: {}
`,
    );
    const finding = findings.find((entry) => entry.ruleId === "schema.property.removed");

    expect(finding).toMatchObject({
      afterValue: null,
      humanPath: "User.nickname",
      jsonPointer: "#/components/schemas/User/properties/nickname",
      ruleId: "schema.property.removed",
      severity: "breaking",
      title: "User.nickname: property removed",
    });
  });

  it("reports a type change from integer to string", async () => {
    const findings = await diffComponentSchemas(
      `User:
  type: object
  properties:
    creditLimit:
      type: integer
`,
      `User:
  type: object
  properties:
    creditLimit:
      type: string
`,
    );
    const finding = findings.find((entry) => entry.ruleId === "schema.type.changed");

    expect(finding).toMatchObject({
      afterValue: ["string"],
      beforeValue: ["integer"],
      humanPath: "User.creditLimit",
      jsonPointer: "#/components/schemas/User/properties/creditLimit",
      ruleId: "schema.type.changed",
      severity: "breaking",
      title: "User.creditLimit: schema type changed",
    });
  });

  it("reports a removed enum value", async () => {
    const findings = await diffComponentSchemas(
      `User:
  type: object
  properties:
    status:
      type: string
      enum:
        - active
        - suspended
        - closed
`,
      `User:
  type: object
  properties:
    status:
      type: string
      enum:
        - active
        - closed
`,
    );
    const finding = findings.find((entry) => entry.ruleId === "schema.enum.value.removed");

    expect(finding).toMatchObject({
      afterValue: null,
      beforeValue: "suspended",
      humanPath: "User.status",
      jsonPointer: "#/components/schemas/User/properties/status/enum",
      ruleId: "schema.enum.value.removed",
      severity: "breaking",
      title: "User.status: enum value removed",
    });
  });

  it("reports additionalProperties becoming restrictive", async () => {
    const findings = await diffComponentSchemas(
      `User:
  type: object
  additionalProperties: true
`,
      `User:
  type: object
  additionalProperties: false
`,
    );
    const finding = findings.find(
      (entry) => entry.ruleId === "schema.additionalProperties.restrictive",
    );

    expect(finding).toMatchObject({
      afterValue: false,
      beforeValue: true,
      humanPath: "User",
      jsonPointer: "#/components/schemas/User/additionalProperties",
      ruleId: "schema.additionalProperties.restrictive",
      severity: "breaking",
      title: "User: additional properties became more restrictive",
    });
  });

  it("reports nested object property changes", async () => {
    const findings = await diffComponentSchemas(
      `User:
  type: object
  properties:
    profile:
      type: object
      properties:
        addressCode:
          type: integer
`,
      `User:
  type: object
  properties:
    profile:
      type: object
      properties:
        addressCode:
          type: string
`,
    );
    const finding = findings.find((entry) => entry.ruleId === "schema.type.changed");

    expect(finding).toMatchObject({
      afterValue: ["string"],
      beforeValue: ["integer"],
      humanPath: "User.profile.addressCode",
      jsonPointer: "#/components/schemas/User/properties/profile/properties/addressCode",
      ruleId: "schema.type.changed",
    });
  });

  it("detects basic allOf and oneOf changes", async () => {
    const findings = await diffComponentSchemas(
      `User:
  allOf:
    - type: object
      properties:
        id:
          type: string
    - type: object
      properties:
        status:
          type: string
  oneOf:
    - type: string
    - type: integer
`,
      `User:
  allOf:
    - type: object
      properties:
        id:
          type: string
    - type: object
      properties:
        state:
          type: string
  oneOf:
    - type: string
    - type: number
`,
    );

    expect(findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining(["schema.allOf.changed", "schema.oneOf.changed"]),
    );
    expect(findings.find((finding) => finding.ruleId === "schema.allOf.changed")).toMatchObject({
      humanPath: "User",
      jsonPointer: "#/components/schemas/User/allOf",
    });
    expect(findings.find((finding) => finding.ruleId === "schema.oneOf.changed")).toMatchObject({
      humanPath: "User",
      jsonPointer: "#/components/schemas/User/oneOf",
    });
  });

  it("does not crash on circular references", async () => {
    const findings = await diffComponentSchemas(
      `Node:
  type: object
  properties:
    next:
      $ref: "#/components/schemas/Node"
`,
      `Node:
  type: object
  properties:
    next:
      $ref: "#/components/schemas/Node"
    label:
      type: string
`,
      "Node",
    );

    expect(findings.some((finding) => finding.ruleId === "schema.property.added.optional")).toBe(
      true,
    );
  });
});

function indentBlock(value: string, spaces: number) {
  const prefix = " ".repeat(spaces);

  return value
    .trimEnd()
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

import { describe, expect, it } from "vitest";
import {
  baseSampleOpenApi31,
  localRefSample,
  revisionSampleOpenApi31,
  unresolvedRefSample,
} from "@/features/openapi-diff/fixtures";
import { normalizeOpenApiDocument } from "@/features/openapi-diff/engine/normalize";
import {
  analyzeOpenApiSpecs,
  parseOpenApiSpec,
} from "@/features/openapi-diff/lib/parser";
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

async function normalizeSpec(id: SpecInput["id"], content: string) {
  const parsed = await parseOpenApiSpec(createSpecInput(id, content));

  expect(parsed.ok).toBe(true);

  if (!parsed.ok) {
    throw new Error("Expected spec to parse before normalization.");
  }

  return normalizeOpenApiDocument(parsed.parsed, parsed.document);
}

describe("normalizeOpenApiDocument", () => {
  it("resolves a local schema ref and preserves pointer evidence", async () => {
    const result = await normalizeSpec("base", localRefSample);
    const responseSchema =
      result.model.paths["/accounts/{accountId}"]?.operations.get?.responses["200"]?.content[
        "application/json"
      ]?.schema;
    const profileSchema = responseSchema?.properties.profile;

    expect(responseSchema).toBeDefined();
    expect(profileSchema).toBeDefined();
    expect(responseSchema?.refKind).toBe("local");
    expect(responseSchema?.evidence.originalPointer).toBe(
      "#/components/schemas/Account",
    );
    expect(responseSchema?.evidence.sourcePath).toBe("#/components/schemas/Account");
    expect(profileSchema?.refKind).toBe("local");
    expect(profileSchema?.evidence.originalPointer).toBe("#/components/schemas/Profile");
  });

  it("detects circular refs and stops safely with a warning", async () => {
    const circularSpec = `openapi: 3.1.0
info:
  title: Circular API
  version: 1.0.0
paths:
  /nodes:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/A"
components:
  schemas:
    A:
      type: object
      properties:
        b:
          $ref: "#/components/schemas/B"
    B:
      type: object
      properties:
        a:
          $ref: "#/components/schemas/A"
`;
    const result = await normalizeSpec("base", circularSpec);
    const circularNode = result.model.paths["/nodes"]?.operations.get?.responses["200"]?.content[
      "application/json"
    ]?.schema?.properties.b?.properties.a;

    expect(circularNode?.refKind).toBe("circular");
    expect(
      result.warnings.some((warning) => warning.code === "normalize.circular-local-ref"),
    ).toBe(true);
  });

  it("merges path-level and operation-level parameters by effective key", async () => {
    const mergeSpec = `openapi: 3.1.0
info:
  title: Merge API
  version: 1.0.0
paths:
  /users/{id}:
    parameters:
      - in: path
        name: id
        required: true
        schema:
          type: string
      - in: query
        name: locale
        required: false
        description: Path locale
        schema:
          type: string
    get:
      parameters:
        - in: query
          name: locale
          required: true
          description: Operation locale
          schema:
            type: string
        - in: query
          name: search
          required: false
          schema:
            type: string
      responses:
        "200":
          description: ok
`;
    const result = await normalizeSpec("base", mergeSpec);
    const parameters = result.model.paths["/users/{id}"]?.operations.get?.parameters;

    expect(Object.keys(parameters ?? {})).toEqual([
      "path:id",
      "query:locale",
      "query:search",
    ]);
    expect(parameters?.["query:locale"]?.required).toBe(true);
    expect(parameters?.["query:locale"]?.description).toBe("Operation locale");
  });

  it("handles missing components gracefully", async () => {
    const result = await normalizeSpec("base", unresolvedRefSample);
    const responseSchema =
      result.model.paths["/accounts"]?.operations.get?.responses["200"]?.content[
        "application/json"
      ]?.schema;

    expect(responseSchema?.refKind).toBe("unresolved");
    expect(
      result.warnings.some((warning) => warning.code === "normalize.unresolved-local-ref"),
    ).toBe(true);
  });

  it("produces stable keys for paths, operations, parameters, responses, and schemas", async () => {
    const result = await normalizeSpec("base", localRefSample);
    const operation = result.model.operations["get /accounts/{accountId}"];

    expect(Object.keys(result.model.paths)).toEqual(["/accounts/{accountId}"]);
    expect(Object.keys(result.model.operations)).toEqual(["get /accounts/{accountId}"]);
    expect(Object.keys(operation?.parameters ?? {})).toEqual(["path:accountId"]);
    expect(Object.keys(operation?.responses ?? {})).toEqual(["200"]);
    expect(Object.keys(result.model.components.schemas)).toEqual([
      "#/components/schemas/Account",
      "#/components/schemas/Profile",
    ]);
  });

  it("supports the analyze flow with normalized serializable models for both sample specs", async () => {
    const result = await analyzeOpenApiSpecs(
      createSpecInput("base", baseSampleOpenApi31),
      createSpecInput("revision", revisionSampleOpenApi31),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected analyzeOpenApiSpecs to succeed.");
    }

    expect(
      result.result.normalized.base.paths["/accounts/{accountId}"]?.operations.get?.key,
    ).toBe("get /accounts/{accountId}");
    expect(
      result.result.normalized.revision.paths["/accounts/{accountId}"]?.operations.get
        ?.responses["200"]?.content["application/json"]?.schema?.key,
    ).toBe("#/components/schemas/Account");
    expect(() => JSON.stringify(result.result.normalized.base)).not.toThrow();
    expect(() => JSON.stringify(result.result.normalized.revision)).not.toThrow();
  });
});

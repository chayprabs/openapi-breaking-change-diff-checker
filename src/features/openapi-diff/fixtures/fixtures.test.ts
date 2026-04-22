import { describe, expect, it } from "vitest";
import {
  baseSampleOpenApi31,
  getOpenApiFixture,
  localRefSample,
  malformedYamlSample,
  openApiFixtures,
  revisionSampleOpenApi31,
  unresolvedRefSample,
} from "@/features/openapi-diff/fixtures";

describe("OpenAPI fixture modules", () => {
  it("exports every fixture through the shared index", () => {
    expect(Object.keys(openApiFixtures)).toEqual([
      "baseSampleOpenApi31",
      "revisionSampleOpenApi31",
      "malformedYamlSample",
      "localRefSample",
      "unresolvedRefSample",
    ]);
  });

  it("loads the core base and revision samples", () => {
    expect(getOpenApiFixture("baseSampleOpenApi31")).toContain("openapi: 3.1.0");
    expect(baseSampleOpenApi31).toContain("/reports/legacy");
    expect(revisionSampleOpenApi31).not.toContain("/reports/legacy");
    expect(revisionSampleOpenApi31).toContain("name: region");
    expect(revisionSampleOpenApi31).toContain("type: string");
    expect(revisionSampleOpenApi31).toContain("- accounts:export");
    expect(revisionSampleOpenApi31).toContain("nickname:");
  });

  it("keeps malformed and ref-specific fixtures distinct", () => {
    expect(malformedYamlSample).toContain("openapi 3.1.0");
    expect(localRefSample).toContain('$ref: "#/components/schemas/Account"');
    expect(localRefSample).toContain('$ref: "#/components/parameters/AccountId"');
    expect(unresolvedRefSample).toContain("MissingAccountList");
  });
});

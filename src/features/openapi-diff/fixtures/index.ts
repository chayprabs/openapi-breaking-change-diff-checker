import { baseSampleOpenApi31 } from "@/features/openapi-diff/fixtures/base-sample-openapi-31";
import { localRefSample } from "@/features/openapi-diff/fixtures/local-ref-sample";
import { malformedYamlSample } from "@/features/openapi-diff/fixtures/malformed-yaml-sample";
import { revisionSampleOpenApi31 } from "@/features/openapi-diff/fixtures/revision-sample-openapi-31";
import { unresolvedRefSample } from "@/features/openapi-diff/fixtures/unresolved-ref-sample";

export const openApiFixtures = {
  baseSampleOpenApi31,
  revisionSampleOpenApi31,
  malformedYamlSample,
  localRefSample,
  unresolvedRefSample,
} as const;

export type OpenApiFixtureName = keyof typeof openApiFixtures;

export function getOpenApiFixture(name: OpenApiFixtureName) {
  return openApiFixtures[name];
}

export {
  baseSampleOpenApi31,
  localRefSample,
  malformedYamlSample,
  revisionSampleOpenApi31,
  unresolvedRefSample,
};

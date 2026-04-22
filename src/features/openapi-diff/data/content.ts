import { baseSampleOpenApi31, revisionSampleOpenApi31 } from "@/features/openapi-diff/fixtures";
import type { RiskBucket } from "@/features/openapi-diff/lib/risk-buckets";

export const semanticChecks = [
  "Removed or renamed endpoints, operations, parameters, schema properties, enums, and response codes",
  "Type narrowing or format changes that can break existing clients even when text diffs look small",
  "Dangerous non-breaking changes such as widened optionality or default shifts that may still change runtime behavior",
  "Safe additions like new optional fields, additive endpoints, or documentation updates",
] as const;

export const outputSections = [
  "Executive summary",
  "Breaking changes",
  "Dangerous changes",
  "Safe changes",
  "Docs-only changes",
  "Suggested follow-up checks",
] as const;

export const openApiDiffPrinciples = [
  "Users can paste or upload two OpenAPI specs.",
  "The tool compares them semantically instead of relying on raw text diffs.",
  "The report separates breaking, dangerous, safe, and docs-only changes.",
  "The core experience works without login.",
  "Local browser processing is preferred whenever practical.",
  "No AI API is required for useful first-version results.",
] as const;

export const sampleRiskCounts: Partial<Record<RiskBucket, number>> = {
  breaking: 4,
  dangerous: 2,
  safe: 9,
  docsOnly: 6,
};

export const baselineSpecExample = baseSampleOpenApi31;

export const candidateSpecExample = revisionSampleOpenApi31;

import { describe, expect, it } from "vitest";
import { getWorkspaceSample } from "@/features/openapi-diff/data/workspace-samples";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import {
  createCustomRedactionRule,
  redactTextSources,
} from "@/features/openapi-diff/lib/redaction";

describe("redaction engine", () => {
  it("detects secret-like values in the privacy-sensitive sample and keeps placeholders stable", () => {
    const sample = getWorkspaceSample("privacy-sensitive");
    const result = redactTextSources(
      [
        { label: "Base spec", value: sample.base },
        { label: "Revision spec", value: sample.revision },
      ],
      createAnalysisSettings({
        redactExamples: true,
        redactServerUrls: true,
      }),
      {
        previewLimit: 8,
        redactedSource: "Workspace sample preview",
      },
    );
    const baseRedacted = result.sources.find((source) => source.label === "Base spec");
    const revisionRedacted = result.sources.find((source) => source.label === "Revision spec");

    expect(result.inspection.detectedSecrets).toBe(true);
    expect(result.inspection.redactedKeys).toEqual(
      expect.arrayContaining([
        "EMAIL",
        "INTERNAL_DOMAIN",
        "PRIVATE_IP",
        "SERVER_URL",
        "TOKEN",
      ]),
    );
    expect(baseRedacted?.redactedValue).toContain("<SERVER_URL_1>");
    expect(baseRedacted?.redactedValue).toContain("<EMAIL_1>");
    expect(revisionRedacted?.redactedValue).toContain("<SERVER_URL_2>");
    expect(baseRedacted?.redactedValue).toContain("<INTERNAL_DOMAIN_1>");
    expect(revisionRedacted?.redactedValue).toContain("<INTERNAL_DOMAIN_1>");
    expect(
      result.inspection.matches.find((match) => match.placeholder === "<INTERNAL_DOMAIN_1>"),
    ).toMatchObject({
      occurrences: 2,
      placeholder: "<INTERNAL_DOMAIN_1>",
    });
  });

  it("redacts examples and server URLs only when those toggles are enabled", () => {
    const source = `servers:
  - url: https://public.example.com/v1
components:
  schemas:
    Session:
      type: object
      properties:
        sampleCode:
          type: string
          example: sample-session-value
`;
    const withoutOptionalRedaction = redactTextSources(
      [{ label: "Spec", value: source }],
      createAnalysisSettings(),
      {
        redactedSource: "Unredacted preview",
      },
    );
    const withOptionalRedaction = redactTextSources(
      [{ label: "Spec", value: source }],
      createAnalysisSettings({
        redactExamples: true,
        redactServerUrls: true,
      }),
      {
        redactedSource: "Redacted preview",
      },
    );

    expect(withoutOptionalRedaction.sources[0]?.redactedValue).toContain(
      "https://public.example.com/v1",
    );
    expect(withoutOptionalRedaction.sources[0]?.redactedValue).toContain(
      "sample-session-value",
    );
    expect(withOptionalRedaction.sources[0]?.redactedValue).toContain("<SERVER_URL_1>");
    expect(withOptionalRedaction.sources[0]?.redactedValue).toContain("<EXAMPLE_1>");
  });

  it("applies custom regex rules with deterministic placeholders", () => {
    const result = redactTextSources(
      [
        {
          label: "Export",
          value: "tenant_ABC123456789 partner tenant_ABC123456789",
        },
      ],
      createAnalysisSettings({
        customRedactionRules: [
          createCustomRedactionRule("tenant_[A-Za-z0-9]{12}", {
            label: "Tenant IDs",
          }),
        ],
      }),
      {
        redactedSource: "Custom rule preview",
      },
    );

    expect(result.inspection.detectedSecrets).toBe(true);
    expect(result.inspection.redactedKeys).toContain("CUSTOM");
    expect(result.sources[0]?.redactedValue).toBe("<CUSTOM_1> partner <CUSTOM_1>");
    expect(result.inspection.matches[0]).toMatchObject({
      occurrences: 2,
      placeholder: "<CUSTOM_1>",
    });
  });
});

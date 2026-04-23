import { describe, expect, it } from "vitest";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import {
  CI_SNIPPET_PARITY_NOTE,
  createCiSnippetBundle,
  createDefaultCiPaths,
} from "@/features/openapi-diff/lib/ci-snippets";

describe("CI snippets", () => {
  it("generates a GitHub Actions snippet with the selected report path and breaking gate", () => {
    const bundle = createCiSnippetBundle({
      baseSpecPath: "specs/openapi.yaml",
      failBuildOnBreaking: true,
      reportOutputPath: "artifacts/api-diff.md",
      revisionSpecPath: "specs/openapi.yaml",
      settings: createAnalysisSettings({
        consumerProfile: "sdkStrict",
        ignoreRules: [
          {
            id: "pathPattern:/internal/*",
            label: "Path /internal/*",
            pathPattern: "/internal/*",
            reason: "Ignore internal routes during partner rollout.",
            source: "pathPattern",
          },
        ],
        remoteRefPolicy: "publicRemote",
        treatEnumAdditionsAsDangerous: true,
      }),
      target: "github",
    });

    expect(bundle.engineLabel).toBe("oasdiff");
    expect(bundle.parityNote).toBe(CI_SNIPPET_PARITY_NOTE);
    expect(bundle.snippet).toContain("uses: oasdiff/oasdiff-action/changelog@v0.0.40-beta.3");
    expect(bundle.snippet).toContain("uses: oasdiff/oasdiff-action/breaking@v0.0.40-beta.3");
    expect(bundle.snippet).toContain("base: 'origin/${{ github.base_ref }}:specs/openapi.yaml'");
    expect(bundle.snippet).toContain("revision: 'HEAD:specs/openapi.yaml'");
    expect(bundle.snippet).toContain("output-to-file: 'artifacts/api-diff.md'");
    expect(bundle.snippet).toContain("fail-on: ERR");
    expect(bundle.settingsSummary).toContain("Profile: SDK strict.");
    expect(bundle.settingsSummary).toContain("Browser remote-ref policy: Allow public remote refs.");
    expect(bundle.settingsSummary).toContain("Browser enum handling: enum additions stay dangerous.");
    expect(bundle.settingsSummary).toContain(
      "Browser ignore rules configured: 1. Recreate them in the chosen OSS engine separately if you need the same gate.",
    );
  });

  it("generates a non-blocking GitLab snippet when fail-on-breaking is disabled", () => {
    const bundle = createCiSnippetBundle({
      baseSpecPath: "openapi/openapi.yaml",
      failBuildOnBreaking: false,
      reportOutputPath: "reports/openapi-diff.md",
      revisionSpecPath: "openapi/openapi.yaml",
      settings: createAnalysisSettings(),
      target: "gitlab",
    });

    expect(bundle.snippet).toContain("apk add --no-cache curl git");
    expect(bundle.snippet).toContain(
      'git fetch --depth=1 origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"',
    );
    expect(bundle.snippet).toContain(
      "oasdiff changelog --format markdown --output-to-file 'reports/openapi-diff.md' 'origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME:openapi/openapi.yaml' 'openapi/openapi.yaml'",
    );
    expect(bundle.snippet).toContain("paths:");
    expect(bundle.snippet).toContain("- 'reports/openapi-diff.md'");
    expect(bundle.snippet).not.toContain("--fail-on ERR");
    expect(bundle.settingsSummary).toContain(
      "Fail build on breaking changes: Off. The snippet stays advisory and still writes Markdown output.",
    );
  });

  it("creates local and Docker snippets from the same default path placeholders", () => {
    const defaults = createDefaultCiPaths();
    const localBundle = createCiSnippetBundle({
      ...defaults,
      failBuildOnBreaking: true,
      settings: createAnalysisSettings(),
      target: "local",
    });
    const dockerBundle = createCiSnippetBundle({
      ...defaults,
      failBuildOnBreaking: true,
      settings: createAnalysisSettings(),
      target: "docker",
    });

    expect(localBundle.snippet).toContain(
      "oasdiff changelog --format markdown --output-to-file 'reports/openapi-diff.md' 'openapi/openapi.yaml' 'openapi/openapi.yaml'",
    );
    expect(localBundle.snippet).toContain(
      "oasdiff breaking --fail-on ERR 'openapi/openapi.yaml' 'openapi/openapi.yaml'",
    );
    expect(dockerBundle.snippet).toContain('  -v "${PWD}:/work" \\');
    expect(dockerBundle.snippet).toContain("tufin/oasdiff changelog --format markdown");
    expect(dockerBundle.snippet).toContain("tufin/oasdiff breaking --fail-on ERR");
  });
});

import {
  formatConsumerProfileLabel,
  formatRemoteRefPolicyLabel,
} from "@/features/openapi-diff/lib/analysis-settings";
import type { AnalysisSettings } from "@/features/openapi-diff/types";

export type CiSnippetTarget = "docker" | "github" | "gitlab" | "local";

export type CiSnippetConfig = {
  baseSpecPath: string;
  failBuildOnBreaking: boolean;
  reportOutputPath: string;
  revisionSpecPath: string;
  settings: AnalysisSettings;
  target: CiSnippetTarget;
};

export type CiSnippetBundle = {
  engineLabel: string;
  parityNote: string;
  settingsSummary: string[];
  snippet: string;
  targetLabel: string;
  usageHint: string;
};

const OASDIFF_ACTION_VERSION = "v0.0.40-beta.3";
const OASDIFF_INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/oasdiff/oasdiff/main/install.sh";
const OASDIFF_DOCKER_IMAGE = "tufin/oasdiff";

export const CI_SNIPPET_PARITY_NOTE =
  "The CI snippet uses the selected open-source engine. Results may differ slightly from this browser report for complex refs or unsupported schema features.";

export const ciSnippetTargetOptions = [
  {
    description: "Use the free oasdiff GitHub Action on pull requests.",
    label: "GitHub Actions",
    value: "github",
  },
  {
    description: "Install oasdiff in a merge-request pipeline and keep the report as an artifact.",
    label: "GitLab CI",
    value: "gitlab",
  },
  {
    description: "Run oasdiff locally or wrap the commands in an npm script.",
    label: "Local CLI",
    value: "local",
  },
  {
    description: "Run the open-source engine in Docker without installing a local binary.",
    label: "Docker",
    value: "docker",
  },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: CiSnippetTarget;
}>;

export function createCiSnippetBundle(config: CiSnippetConfig): CiSnippetBundle {
  return {
    engineLabel: "oasdiff",
    parityNote: CI_SNIPPET_PARITY_NOTE,
    settingsSummary: createSettingsSummary(config),
    snippet: createSnippet(config),
    targetLabel:
      ciSnippetTargetOptions.find((option) => option.value === config.target)?.label ??
      ciSnippetTargetOptions[0].label,
    usageHint: createUsageHint(config.target),
  };
}

export function createDefaultCiPaths() {
  return {
    baseSpecPath: "openapi/openapi.yaml",
    reportOutputPath: "reports/openapi-diff.md",
    revisionSpecPath: "openapi/openapi.yaml",
  };
}

function createSnippet(config: CiSnippetConfig) {
  switch (config.target) {
    case "github":
      return createGitHubActionsSnippet(config);
    case "gitlab":
      return createGitLabSnippet(config);
    case "docker":
      return createDockerSnippet(config);
    case "local":
    default:
      return createLocalCliSnippet(config);
  }
}

function createGitHubActionsSnippet(config: CiSnippetConfig) {
  const watchedPaths = [...new Set([config.baseSpecPath, config.revisionSpecPath])];
  const failOnLines = config.failBuildOnBreaking
    ? ["          fail-on: ERR"]
    : [];

  return [
    "name: OpenAPI breaking changes",
    "",
    "on:",
    "  pull_request:",
    "    paths:",
    ...watchedPaths.map((path) => `      - ${quoteYaml(path)}`),
    "",
    "jobs:",
    "  openapi-diff:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v6",
    "",
    "      - name: Fetch base branch for comparison",
    "        run: git fetch --depth=1 origin ${{ github.base_ref }}",
    "",
    "      - name: Write Markdown changelog",
    `        uses: oasdiff/oasdiff-action/changelog@${OASDIFF_ACTION_VERSION}`,
    "        with:",
    `          base: ${quoteYaml(`origin/\${{ github.base_ref }}:${config.baseSpecPath}`)}`,
    `          revision: ${quoteYaml(`HEAD:${config.revisionSpecPath}`)}`,
    "          format: markdown",
    `          output-to-file: ${quoteYaml(config.reportOutputPath)}`,
    "",
    "      - name: Check breaking changes",
    `        uses: oasdiff/oasdiff-action/breaking@${OASDIFF_ACTION_VERSION}`,
    "        with:",
    `          base: ${quoteYaml(`origin/\${{ github.base_ref }}:${config.baseSpecPath}`)}`,
    `          revision: ${quoteYaml(`HEAD:${config.revisionSpecPath}`)}`,
    ...failOnLines,
    "",
    "      # Optional: upload the generated Markdown report in a later step if you want",
    "      # it attached to the workflow run or posted back into the pull request.",
  ].join("\n");
}

function createGitLabSnippet(config: CiSnippetConfig) {
  const baseRefPath = `origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME:${config.baseSpecPath}`;
  const failCommand = createBreakingCommand(config, baseRefPath, config.revisionSpecPath);

  return [
    "openapi_diff:",
    "  image: alpine:3.20",
    "  stage: test",
    "  rules:",
    '    - if: $CI_PIPELINE_SOURCE == "merge_request_event"',
    "  before_script:",
    "    - apk add --no-cache curl git",
    `    - curl -fsSL ${quoteShell(OASDIFF_INSTALL_SCRIPT_URL)} | sh`,
    "  script:",
    '    - git fetch --depth=1 origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"',
    `    - mkdir -p "$(dirname ${quoteShell(config.reportOutputPath)})"`,
    `    - ${createChangelogCommand(baseRefPath, config.revisionSpecPath, config.reportOutputPath)}`,
    `    - ${failCommand}`,
    "  artifacts:",
    "    when: always",
    "    paths:",
    `      - ${quoteYaml(config.reportOutputPath)}`,
  ].join("\n");
}

function createLocalCliSnippet(config: CiSnippetConfig) {
  return [
    `mkdir -p "$(dirname ${quoteShell(config.reportOutputPath)})"`,
    createChangelogCommand(
      config.baseSpecPath,
      config.revisionSpecPath,
      config.reportOutputPath,
    ),
    createBreakingCommand(config, config.baseSpecPath, config.revisionSpecPath),
  ].join("\n");
}

function createDockerSnippet(config: CiSnippetConfig) {
  return [
    `mkdir -p "$(dirname ${quoteShell(config.reportOutputPath)})"`,
    createDockerCommand(
      `changelog --format markdown --output-to-file ${quoteShell(config.reportOutputPath)} ${quoteShell(config.baseSpecPath)} ${quoteShell(config.revisionSpecPath)}`,
    ),
    createDockerCommand(
      createBreakingCommand(config, config.baseSpecPath, config.revisionSpecPath).replace(
        /^oasdiff /,
        "",
      ),
    ),
  ].join("\n\n");
}

function createSettingsSummary(config: CiSnippetConfig) {
  const ignoreRuleCount = config.settings.ignoreRules.length;

  return [
    `Profile: ${formatConsumerProfileLabel(config.settings.consumerProfile)}.`,
    config.failBuildOnBreaking
      ? "Fail build on breaking changes: On."
      : "Fail build on breaking changes: Off. The snippet stays advisory and still writes Markdown output.",
    `Browser remote-ref policy: ${formatRemoteRefPolicyLabel(config.settings.remoteRefPolicy)}.`,
    config.settings.treatEnumAdditionsAsDangerous
      ? "Browser enum handling: enum additions stay dangerous."
      : "Browser enum handling: enum additions use the browser tool's default severity logic.",
    ignoreRuleCount > 0
      ? `Browser ignore rules configured: ${ignoreRuleCount}. Recreate them in the chosen OSS engine separately if you need the same gate.`
      : "Browser ignore rules configured: none.",
  ];
}

function createUsageHint(target: CiSnippetTarget) {
  if (target === "github" || target === "gitlab") {
    return "Use CI when you want pull requests to produce a repeatable report and optionally block merges on breaking changes.";
  }

  if (target === "docker") {
    return "Use Docker when you want the open-source engine without installing a local binary on the machine running the check.";
  }

  return "Use the local CLI when you want to test the same open-source gate locally before you wire it into CI.";
}

function createChangelogCommand(
  baseSpecPath: string,
  revisionSpecPath: string,
  reportOutputPath: string,
) {
  return [
    "oasdiff",
    "changelog",
    "--format",
    "markdown",
    "--output-to-file",
    quoteShell(reportOutputPath),
    quoteShell(baseSpecPath),
    quoteShell(revisionSpecPath),
  ].join(" ");
}

function createBreakingCommand(
  config: Pick<CiSnippetConfig, "failBuildOnBreaking">,
  baseSpecPath: string,
  revisionSpecPath: string,
) {
  return [
    "oasdiff",
    "breaking",
    ...(config.failBuildOnBreaking ? ["--fail-on", "ERR"] : []),
    quoteShell(baseSpecPath),
    quoteShell(revisionSpecPath),
  ].join(" ");
}

function createDockerCommand(args: string) {
  return [
    "docker run --rm -t \\",
    '  -v "${PWD}:/work" \\',
    "  -w /work \\",
    `  ${OASDIFF_DOCKER_IMAGE} ${args}`,
  ].join("\n");
}

function quoteShell(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function quoteYaml(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

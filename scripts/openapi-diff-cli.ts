#!/usr/bin/env node
/**
 * Headless OpenAPI diff using the same in-repo engine as the browser worker.
 *
 * Usage:
 *   pnpm openapi-diff --base openapi/base.yaml --revision openapi/revision.yaml
 *   pnpm openapi-diff --base base.yaml --revision revision.yaml --format json --fail-on breaking
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAnalysisSettings } from "../src/features/openapi-diff/lib/analysis-settings";
import { analyzeOpenApiSpecs } from "../src/features/openapi-diff/lib/parser";
import {
  createReportExportBundle,
} from "../src/features/openapi-diff/lib/report-export";
import { createReportFindingRows } from "../src/features/openapi-diff/lib/report-explorer";
import { createSpecInput } from "../src/features/openapi-diff/test-support/openapi-diff-test-harness";
import type { DiffReport, DiffSeverity } from "../src/features/openapi-diff/types";

type CliFormat = "json" | "markdown" | "html";

type CliOptions = {
  basePath: string;
  consumerProfile: string | null;
  failOn: DiffSeverity[];
  format: CliFormat;
  outputPath: string | null;
  revisionPath: string;
  settingsPath: string | null;
};

function printHelp() {
  console.log(`Authos OpenAPI Diff (CLI)

Compare two OpenAPI/Swagger specs with the in-repo semantic engine.

Options:
  --base <path>           Baseline spec (YAML or JSON) [required]
  --revision <path>       Candidate spec (YAML or JSON) [required]
  --format <json|markdown|html>  Output format (default: json)
  --output <path>         Write output to file instead of stdout
  --fail-on <severities>  Comma-separated: breaking,dangerous,safe,info
  --profile <id>          Consumer profile: publicApi, internalApi, sdkStrict, mobileClient, tolerantClient
  --settings <path>       JSON settings file exported from the browser UI
  --help                  Show this message

Examples:
  pnpm openapi-diff --base specs/base.yaml --revision specs/revision.yaml
  pnpm openapi-diff --base base.yaml --revision revision.yaml --format markdown --output report.md
  pnpm openapi-diff --base base.yaml --revision revision.yaml --fail-on breaking,dangerous
`);
}

function parseArgs(argv: string[]): CliOptions | null {
  let basePath: string | null = null;
  let revisionPath: string | null = null;
  let format: CliFormat = "json";
  let outputPath: string | null = null;
  let failOn: DiffSeverity[] = [];
  let consumerProfile: string | null = null;
  let settingsPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help" || token === "-h") {
      printHelp();
      return null;
    }

    if (token === "--base") {
      basePath = argv[++index] ?? null;
      continue;
    }

    if (token === "--revision") {
      revisionPath = argv[++index] ?? null;
      continue;
    }

    if (token === "--format") {
      const value = argv[++index];

      if (value === "json" || value === "markdown" || value === "html") {
        format = value;
      } else {
        throw new Error(`Unsupported format: ${value}`);
      }

      continue;
    }

    if (token === "--output") {
      outputPath = argv[++index] ?? null;
      continue;
    }

    if (token === "--fail-on") {
      const value = argv[++index] ?? "";
      failOn = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean) as DiffSeverity[];
      continue;
    }

    if (token === "--profile") {
      consumerProfile = argv[++index] ?? null;
      continue;
    }

    if (token === "--settings") {
      settingsPath = argv[++index] ?? null;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!basePath || !revisionPath) {
    printHelp();
    process.exitCode = 1;
    return null;
  }

  return {
    basePath,
    consumerProfile,
    failOn,
    format,
    outputPath,
    revisionPath,
    settingsPath,
  };
}

function readSettingsFile(path: string) {
  const absolutePath = resolve(path);
  let content: string;

  try {
    content = readFileSync(absolutePath, "utf8");
  } catch (error) {
    throw toReadableIoError(`settings file`, absolutePath, error);
  }

  try {
    return createAnalysisSettings(
      JSON.parse(content) as Partial<ReturnType<typeof createAnalysisSettings>>,
    );
  } catch {
    throw new Error(`Settings file is not valid JSON: ${absolutePath}`);
  }
}

function readSpecFile(path: string, id: "base" | "revision") {
  const absolutePath = resolve(path);
  let content: string;

  try {
    content = readFileSync(absolutePath, "utf8");
  } catch (error) {
    throw toReadableIoError(`${id} spec file`, absolutePath, error);
  }

  return createSpecInput(id, content, {
    filename: absolutePath.split(/[/\\]/).pop() ?? `${id}.yaml`,
  });
}

function toReadableIoError(label: string, absolutePath: string, error: unknown) {
  if (isNodeError(error) && error.code === "ENOENT") {
    return new Error(`Cannot read ${label}: ${absolutePath} (file not found)`);
  }

  if (isNodeError(error) && error.code === "EISDIR") {
    return new Error(`Cannot read ${label}: ${absolutePath} (path is a directory)`);
  }

  return new Error(`Cannot read ${label}: ${absolutePath}`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function formatOutput(format: CliFormat, report: DiffReport) {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  const rows = createReportFindingRows(report);
  const bundle = createReportExportBundle(report, rows, {
    includeIgnoredFindings: true,
    includeSafeChanges: true,
    redactBeforeExport: false,
  });

  return format === "markdown"
    ? bundle.artifacts.markdown.content
    : bundle.artifacts.html.content;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (!options) {
      return;
    }

    const settings = options.settingsPath
      ? readSettingsFile(options.settingsPath)
      : createAnalysisSettings({
          ...(options.consumerProfile
            ? { consumerProfile: options.consumerProfile as never }
            : {}),
          ...(options.failOn.length > 0 ? { failOnSeverities: options.failOn } : {}),
        });

    const result = await analyzeOpenApiSpecs(
      readSpecFile(options.basePath, "base"),
      readSpecFile(options.revisionPath, "revision"),
      { settings },
    );

    if (!result.ok) {
      console.error(JSON.stringify({ errors: result.errors, warnings: result.warnings }, null, 2));
      process.exitCode = 1;
      return;
    }

    const output = formatOutput(options.format, result.result.report);

    if (options.outputPath) {
      writeFileSync(resolve(options.outputPath), output, "utf8");
      console.error(`Wrote ${options.format} report to ${resolve(options.outputPath)}`);
    } else {
      process.stdout.write(`${output}\n`);
    }

    const failSeverities = options.failOn.length > 0 ? options.failOn : settings.failOnSeverities;
    const matched = failSeverities.some(
      (severity) => (result.result.report.summary.bySeverity[severity] ?? 0) > 0,
    );

    if (matched) {
      console.error(
        `Found findings at configured fail-on severities: ${failSeverities.join(", ")}`,
      );
      process.exitCode = 2;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

void main();

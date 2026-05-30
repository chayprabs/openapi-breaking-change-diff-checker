import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  baseSampleOpenApi31,
  malformedYamlSample,
  revisionSampleOpenApi31,
} from "../src/features/openapi-diff/fixtures";

const CLI_PATH = fileURLToPath(new URL("./openapi-diff-cli.ts", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const TSX_CLI = join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

function runCli(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [TSX_CLI, CLI_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function writeSpecPair(directory: string) {
  const basePath = join(directory, "base.yaml");
  const revisionPath = join(directory, "revision.yaml");
  writeFileSync(basePath, baseSampleOpenApi31, "utf8");
  writeFileSync(revisionPath, revisionSampleOpenApi31, "utf8");
  return { basePath, revisionPath };
}

describe("openapi-diff CLI", () => {
  it("prints help and exits 0 for --help", () => {
    const result = runCli(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--base");
    expect(result.stderr).toBe("");
  });

  it("exits 1 when required file arguments are missing", () => {
    const result = runCli([]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("--base");
    expect(result.stderr).toBe("");
  });

  it("exits 1 with a readable message when spec files are missing", () => {
    const result = runCli([
      "--base",
      "definitely-missing-base.yaml",
      "--revision",
      "definitely-missing-revision.yaml",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("file not found");
    expect(result.stderr).not.toContain("ENOENT");
  });

  it("exits 1 for unsupported output formats without a stack trace", () => {
    const directory = mkdtempSync(join(tmpdir(), "openapi-cli-"));
    const { basePath, revisionPath } = writeSpecPair(directory);

    try {
      const result = runCli(["--base", basePath, "--revision", revisionPath, "--format", "xml"]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Unsupported format: xml");
      expect(result.stderr).not.toContain("at parseArgs");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("exits 1 for unknown flags", () => {
    const directory = mkdtempSync(join(tmpdir(), "openapi-cli-"));
    const { basePath, revisionPath } = writeSpecPair(directory);

    try {
      const result = runCli(["--base", basePath, "--revision", revisionPath, "--totally-unknown"]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Unknown argument");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("writes valid JSON report output when specs differ", () => {
    const directory = mkdtempSync(join(tmpdir(), "openapi-cli-"));
    const { basePath, revisionPath } = writeSpecPair(directory);

    try {
      const result = runCli(["--base", basePath, "--revision", revisionPath]);

      expect(result.status).toBe(2);
      const report = JSON.parse(result.stdout) as { summary: { totalFindings: number } };
      expect(report.summary.totalFindings).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("exits 0 when comparing identical specs with no breaking findings", () => {
    const directory = mkdtempSync(join(tmpdir(), "openapi-cli-"));
    const basePath = join(directory, "base.yaml");
    writeFileSync(basePath, baseSampleOpenApi31, "utf8");

    try {
      const result = runCli(["--base", basePath, "--revision", basePath]);

      expect(result.status).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("writes markdown output to --output path", () => {
    const directory = mkdtempSync(join(tmpdir(), "openapi-cli-"));
    const basePath = join(directory, "base.yaml");
    writeFileSync(basePath, baseSampleOpenApi31, "utf8");
    const outputPath = join(directory, "report.md");

    try {
      const result = runCli([
        "--base",
        basePath,
        "--revision",
        basePath,
        "--format",
        "markdown",
        "--output",
        outputPath,
      ]);

      expect(result.status).toBe(0);
      const markdown = readFileSync(outputPath, "utf8");
      expect(markdown).toContain("#");
      expect(result.stderr).toContain("Wrote markdown report");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("exits 2 when --fail-on severities match findings", () => {
    const directory = mkdtempSync(join(tmpdir(), "openapi-cli-"));
    const { basePath, revisionPath } = writeSpecPair(directory);

    try {
      const result = runCli([
        "--base",
        basePath,
        "--revision",
        revisionPath,
        "--fail-on",
        "breaking",
      ]);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("fail-on severities");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("exits 1 with parser errors for malformed specs", () => {
    const directory = mkdtempSync(join(tmpdir(), "openapi-cli-"));
    const basePath = join(directory, "base.yaml");
    const revisionPath = join(directory, "revision.yaml");
    writeFileSync(basePath, baseSampleOpenApi31, "utf8");
    writeFileSync(revisionPath, malformedYamlSample, "utf8");

    try {
      const result = runCli(["--base", basePath, "--revision", revisionPath]);

      expect(result.status).toBe(1);
      const payload = JSON.parse(result.stderr) as { errors: unknown[] };
      expect(payload.errors.length).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("exits 1 when settings JSON is invalid", () => {
    const directory = mkdtempSync(join(tmpdir(), "openapi-cli-"));
    const { basePath, revisionPath } = writeSpecPair(directory);
    const settingsPath = join(directory, "settings.json");
    writeFileSync(settingsPath, "{not-json", "utf8");

    try {
      const result = runCli([
        "--base",
        basePath,
        "--revision",
        revisionPath,
        "--settings",
        settingsPath,
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("not valid JSON");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

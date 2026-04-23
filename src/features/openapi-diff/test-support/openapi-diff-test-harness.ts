import { normalizeOpenApiDocument } from "@/features/openapi-diff/engine/normalize";
import { buildOpenApiDiffReport } from "@/features/openapi-diff/engine/diff";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import {
  analyzeOpenApiSpecs,
  parseOpenApiSpec,
  type ParseOpenApiSpecResult,
} from "@/features/openapi-diff/lib/parser";
import type {
  AnalysisSettings,
  DiffReport,
  NormalizedOpenApiModel,
  OpenApiHttpMethod,
  SpecInput,
  WorkspacePanelId,
} from "@/features/openapi-diff/types";

type CreateSpecInputOptions = {
  filename?: string;
  format?: SpecInput["format"];
  source?: SpecInput["source"];
  url?: string;
};

type ParsedSpecSuccess = Extract<ParseOpenApiSpecResult, { ok: true }>;

export function createSpecInput(
  id: WorkspacePanelId,
  content: string,
  options: CreateSpecInputOptions = {},
): SpecInput {
  return {
    content,
    ...(options.filename ? { filename: options.filename } : {}),
    format: options.format ?? "yaml",
    id,
    label: id === "base" ? "Base spec" : "Revision spec",
    source: options.source ?? "sample",
    ...(options.url ? { url: options.url } : {}),
  };
}

export async function parseSpecOrThrow(
  id: WorkspacePanelId,
  content: string,
  options: CreateSpecInputOptions = {},
): Promise<ParsedSpecSuccess> {
  const result = await parseOpenApiSpec(createSpecInput(id, content, options));

  if (!result.ok) {
    throw new Error(
      `Expected ${id} spec to parse successfully, received: ${result.errors
        .map((error) => error.message)
        .join(" | ")}`,
    );
  }

  return result;
}

export async function normalizeSpecOrThrow(
  id: WorkspacePanelId,
  content: string,
  options: CreateSpecInputOptions = {},
) {
  const parsed = await parseSpecOrThrow(id, content, options);
  return normalizeOpenApiDocument(parsed.parsed, parsed.document);
}

export async function buildReportFromContents(
  baseContent: string,
  revisionContent: string,
  settings: Partial<AnalysisSettings> = {},
): Promise<DiffReport> {
  const baseParsed = await parseSpecOrThrow("base", baseContent);
  const revisionParsed = await parseSpecOrThrow("revision", revisionContent);

  return buildOpenApiDiffReport({
    baseModel: normalizeOpenApiDocument(baseParsed.parsed, baseParsed.document).model,
    baseline: baseParsed.parsed,
    candidate: revisionParsed.parsed,
    generatedAt: "2026-04-23T00:00:00.000Z",
    revisionModel: normalizeOpenApiDocument(revisionParsed.parsed, revisionParsed.document).model,
    settings: createAnalysisSettings(settings),
  });
}

export async function analyzeSpecsFromContents(
  baseContent: string,
  revisionContent: string,
  settings: Partial<AnalysisSettings> = {},
): Promise<Awaited<ReturnType<typeof analyzeOpenApiSpecs>>> {
  return analyzeOpenApiSpecs(
    createSpecInput("base", baseContent),
    createSpecInput("revision", revisionContent),
    {
      settings: createAnalysisSettings(settings),
    },
  );
}

export function getOperationOrThrow(
  model: NormalizedOpenApiModel,
  method: OpenApiHttpMethod,
  path: string,
) {
  const operation = model.paths[path]?.operations[method];

  if (!operation) {
    throw new Error(`Expected operation ${method.toUpperCase()} ${path} to exist.`);
  }

  return operation;
}

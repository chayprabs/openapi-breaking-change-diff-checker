import { applyAnalysisSettingsToFindings } from "@/features/openapi-diff/engine/classify";
import {
  diffOperationDetailsAcrossPaths,
  diffPathsAndOperations,
} from "@/features/openapi-diff/engine/diff-paths";
import { getDiffReportWarnings, sortDiffFindings } from "@/features/openapi-diff/engine/diff-support";
import { buildReport } from "@/features/openapi-diff/engine/report";
import {
  createAnalysisSettings,
} from "@/features/openapi-diff/lib/analysis-settings";
import type {
  AnalysisSettings,
  DiffFinding,
  DiffReport,
  NormalizedOpenApiModel,
  ParsedSpec,
} from "@/features/openapi-diff/types";

type BuildOpenApiDiffReportOptions = {
  baseModel: NormalizedOpenApiModel;
  baseline: ParsedSpec;
  candidate: ParsedSpec;
  generatedAt?: string;
  revisionModel: NormalizedOpenApiModel;
  settings?: AnalysisSettings;
};

export function buildOpenApiDiffReport(
  options: BuildOpenApiDiffReportOptions,
): DiffReport {
  const settings = createAnalysisSettings(options.settings);
  const rawFindings = collectOpenApiDiffFindings(
    options.baseModel,
    options.revisionModel,
  );
  const classifiedFindings = classifyOpenApiDiffFindings(rawFindings, settings);

  return buildReport(options.baseline, options.candidate, classifiedFindings, settings, {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    warnings: getDiffReportWarnings(options.baseModel, options.revisionModel),
  });
}

export function collectOpenApiDiffFindings(
  baseModel: NormalizedOpenApiModel,
  revisionModel: NormalizedOpenApiModel,
): DiffFinding[] {
  return [
    ...diffPathsAndOperations(baseModel, revisionModel),
    ...diffOperationDetailsAcrossPaths(baseModel, revisionModel),
  ];
}

export function classifyOpenApiDiffFindings(
  findings: readonly DiffFinding[],
  settings: AnalysisSettings,
): DiffFinding[] {
  return sortDiffFindings(applyAnalysisSettingsToFindings(findings, settings));
}

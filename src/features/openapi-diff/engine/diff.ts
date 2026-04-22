import { applyAnalysisSettingsToFindings } from "@/features/openapi-diff/engine/classify";
import { diffPaths } from "@/features/openapi-diff/engine/diff-paths";
import { getDiffReportWarnings, sortDiffFindings } from "@/features/openapi-diff/engine/diff-support";
import { buildReport } from "@/features/openapi-diff/engine/report";
import {
  createAnalysisSettings,
} from "@/features/openapi-diff/lib/analysis-settings";
import type {
  AnalysisSettings,
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
  const rawFindings = diffPaths(options.baseModel, options.revisionModel);
  const classifiedFindings = sortDiffFindings(
    applyAnalysisSettingsToFindings(rawFindings, settings),
  );

  return buildReport(options.baseline, options.candidate, classifiedFindings, settings, {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    warnings: getDiffReportWarnings(options.baseModel, options.revisionModel),
  });
}

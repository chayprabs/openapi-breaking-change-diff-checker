import { reclassifyDiffReport } from "@/features/openapi-diff/engine/classify";
import { diffPaths } from "@/features/openapi-diff/engine/diff-paths";
import {
  buildDiffSummary,
  getDiffReportWarnings,
  sortDiffFindings,
} from "@/features/openapi-diff/engine/diff-support";
import {
  cloneAnalysisSettings,
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
  const rawFindings = sortDiffFindings(diffPaths(options.baseModel, options.revisionModel));
  const rawReport: DiffReport = {
    baseline: options.baseline,
    candidate: options.candidate,
    findings: rawFindings,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    settings: cloneAnalysisSettings(settings),
    summary: buildDiffSummary(rawFindings),
    warnings: getDiffReportWarnings(options.baseModel, options.revisionModel),
  };

  return reclassifyDiffReport(rawReport, settings);
}

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
  return attachOperationContextToFindings(
    [
    ...diffPathsAndOperations(baseModel, revisionModel),
    ...diffOperationDetailsAcrossPaths(baseModel, revisionModel),
    ],
    baseModel,
    revisionModel,
  );
}

export function classifyOpenApiDiffFindings(
  findings: readonly DiffFinding[],
  settings: AnalysisSettings,
): DiffFinding[] {
  return sortDiffFindings(applyAnalysisSettingsToFindings(findings, settings));
}

export function attachOperationContextToFindings(
  findings: readonly DiffFinding[],
  baseModel: NormalizedOpenApiModel,
  revisionModel: NormalizedOpenApiModel,
): DiffFinding[] {
  return findings.map((finding) => {
    if (!finding.path || !finding.method) {
      return finding;
    }

    const operationKey = `${finding.method} ${finding.path}`;
    const baseOperation = baseModel.operations[operationKey];
    const revisionOperation = revisionModel.operations[operationKey];

    if (!baseOperation && !revisionOperation) {
      return finding;
    }

    const tags = [...new Set([
      ...(finding.tags ?? []),
      ...(baseOperation?.tags ?? []),
      ...(revisionOperation?.tags ?? []),
    ])].sort((left, right) => left.localeCompare(right));
    const operationDeprecated =
      finding.operationDeprecated ??
      Boolean(baseOperation?.deprecated || revisionOperation?.deprecated);
    const operationId =
      finding.operationId ??
      revisionOperation?.operationId ??
      baseOperation?.operationId;

    return {
      ...finding,
      ...(tags.length ? { tags } : {}),
      ...(operationDeprecated !== undefined ? { operationDeprecated } : {}),
      ...(operationId ? { operationId } : {}),
    };
  });
}

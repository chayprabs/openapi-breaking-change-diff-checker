import type { ReportExportFormat } from "@/features/openapi-diff/lib/report-export";
import {
  createDefaultCiPaths,
  type CiSnippetTarget,
} from "@/features/openapi-diff/lib/ci-snippets";
import {
  createDefaultFindingsExplorerFilters,
  type FindingsExplorerFilters,
  type FindingsSortOption,
} from "@/features/openapi-diff/lib/report-explorer";
import { ruleIds, type RuleId } from "@/features/openapi-diff/types";

export type WorkspaceMobileTab = "base" | "revision" | "results";

export type ReportExplorerTab =
  | "summary"
  | "endpoints"
  | "schemas"
  | "security"
  | "findings"
  | "ignored"
  | "ci"
  | "export";

export type ReportExplorerUiState = {
  activeTab: ReportExplorerTab;
  ciBaseSpecPath: string;
  ciFailBuildOnBreaking: boolean;
  ciReportOutputPath: string;
  ciRevisionSpecPath: string;
  ciTarget: CiSnippetTarget;
  exportPreviewFormat: ReportExportFormat;
  filters: FindingsExplorerFilters;
  includeIgnoredInExport: boolean;
  includeSafeInExport: boolean;
  redactBeforeExport: boolean;
};

const WORKSPACE_MOBILE_TABS = ["base", "revision", "results"] as const satisfies readonly WorkspaceMobileTab[];
const REPORT_EXPLORER_TABS = [
  "summary",
  "endpoints",
  "schemas",
  "security",
  "findings",
  "ignored",
  "ci",
  "export",
] as const satisfies readonly ReportExplorerTab[];
const CI_SNIPPET_TARGETS = [
  "docker",
  "github",
  "gitlab",
  "local",
] as const satisfies readonly CiSnippetTarget[];
const REPORT_EXPORT_FORMATS = [
  "html",
  "json",
  "markdown",
] as const satisfies readonly ReportExportFormat[];
const FINDINGS_SORT_OPTIONS = [
  "severity",
  "path",
  "category",
  "rule",
] as const satisfies readonly FindingsSortOption[];
const DIFF_CATEGORIES = [
  "docs",
  "enum",
  "metadata",
  "operation",
  "parameter",
  "path",
  "requestBody",
  "response",
  "schema",
  "security",
] as const;
const DIFF_SEVERITIES = [
  "breaking",
  "dangerous",
  "safe",
  "info",
] as const;
const HTTP_METHODS = [
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
] as const;
const RULE_ID_LOOKUP = new Set<RuleId>(ruleIds);

export function createDefaultReportExplorerUiState(): ReportExplorerUiState {
  const ciDefaults = createDefaultCiPaths();

  return {
    activeTab: "summary",
    ciBaseSpecPath: ciDefaults.baseSpecPath,
    ciFailBuildOnBreaking: true,
    ciReportOutputPath: ciDefaults.reportOutputPath,
    ciRevisionSpecPath: ciDefaults.revisionSpecPath,
    ciTarget: "github",
    exportPreviewFormat: "markdown",
    filters: createDefaultFindingsExplorerFilters(),
    includeIgnoredInExport: false,
    includeSafeInExport: false,
    redactBeforeExport: false,
  };
}

export function cloneReportExplorerUiState(
  state: ReportExplorerUiState,
): ReportExplorerUiState {
  return {
    activeTab: state.activeTab,
    ciBaseSpecPath: state.ciBaseSpecPath,
    ciFailBuildOnBreaking: state.ciFailBuildOnBreaking,
    ciReportOutputPath: state.ciReportOutputPath,
    ciRevisionSpecPath: state.ciRevisionSpecPath,
    ciTarget: state.ciTarget,
    exportPreviewFormat: state.exportPreviewFormat,
    filters: { ...state.filters },
    includeIgnoredInExport: state.includeIgnoredInExport,
    includeSafeInExport: state.includeSafeInExport,
    redactBeforeExport: state.redactBeforeExport,
  };
}

export function isWorkspaceMobileTab(value: unknown): value is WorkspaceMobileTab {
  return typeof value === "string" && WORKSPACE_MOBILE_TABS.includes(value as WorkspaceMobileTab);
}

export function parseWorkspaceMobileTab(
  value: unknown,
  fallback: WorkspaceMobileTab = "base",
): WorkspaceMobileTab {
  return isWorkspaceMobileTab(value) ? value : fallback;
}

export function parseReportExplorerUiState(value: unknown): ReportExplorerUiState {
  if (!isRecord(value)) {
    return createDefaultReportExplorerUiState();
  }

  const defaults = createDefaultReportExplorerUiState();

  return {
    activeTab:
      typeof value.activeTab === "string" &&
      REPORT_EXPLORER_TABS.includes(value.activeTab as ReportExplorerTab)
        ? (value.activeTab as ReportExplorerTab)
        : defaults.activeTab,
    ciBaseSpecPath: parseNonEmptyString(value.ciBaseSpecPath, defaults.ciBaseSpecPath),
    ciFailBuildOnBreaking:
      typeof value.ciFailBuildOnBreaking === "boolean"
        ? value.ciFailBuildOnBreaking
        : defaults.ciFailBuildOnBreaking,
    ciReportOutputPath: parseNonEmptyString(
      value.ciReportOutputPath,
      defaults.ciReportOutputPath,
    ),
    ciRevisionSpecPath: parseNonEmptyString(
      value.ciRevisionSpecPath,
      defaults.ciRevisionSpecPath,
    ),
    ciTarget:
      typeof value.ciTarget === "string" &&
      CI_SNIPPET_TARGETS.includes(value.ciTarget as CiSnippetTarget)
        ? (value.ciTarget as CiSnippetTarget)
        : defaults.ciTarget,
    exportPreviewFormat:
      typeof value.exportPreviewFormat === "string" &&
      REPORT_EXPORT_FORMATS.includes(value.exportPreviewFormat as ReportExportFormat)
        ? (value.exportPreviewFormat as ReportExportFormat)
        : defaults.exportPreviewFormat,
    filters: parseFindingsExplorerFilters(value.filters),
    includeIgnoredInExport: value.includeIgnoredInExport === true,
    includeSafeInExport: value.includeSafeInExport === true,
    redactBeforeExport: value.redactBeforeExport === true,
  };
}

function parseFindingsExplorerFilters(value: unknown): FindingsExplorerFilters {
  const defaults = createDefaultFindingsExplorerFilters();

  if (!isRecord(value)) {
    return defaults;
  }

  return {
    category:
      typeof value.category === "string" &&
      (value.category === "all" ||
        DIFF_CATEGORIES.includes(value.category as (typeof DIFF_CATEGORIES)[number]))
        ? (value.category as FindingsExplorerFilters["category"])
        : defaults.category,
    method:
      typeof value.method === "string" &&
      (value.method === "all" ||
        HTTP_METHODS.includes(value.method as (typeof HTTP_METHODS)[number]))
        ? (value.method as FindingsExplorerFilters["method"])
        : defaults.method,
    path:
      typeof value.path === "string" && (value.path === "all" || value.path.trim())
        ? value.path
        : defaults.path,
    ruleId:
      typeof value.ruleId === "string" &&
      (value.ruleId === "all" || RULE_ID_LOOKUP.has(value.ruleId as RuleId))
        ? (value.ruleId as FindingsExplorerFilters["ruleId"])
        : defaults.ruleId,
    schema:
      typeof value.schema === "string" && (value.schema === "all" || value.schema.trim())
        ? value.schema
        : defaults.schema,
    search: typeof value.search === "string" ? value.search : defaults.search,
    severity:
      typeof value.severity === "string" &&
      (value.severity === "all" ||
        DIFF_SEVERITIES.includes(value.severity as (typeof DIFF_SEVERITIES)[number]))
        ? (value.severity as FindingsExplorerFilters["severity"])
        : defaults.severity,
    sort:
      typeof value.sort === "string" &&
      FINDINGS_SORT_OPTIONS.includes(value.sort as FindingsSortOption)
        ? (value.sort as FindingsSortOption)
        : defaults.sort,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNonEmptyString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

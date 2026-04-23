import type { WorkspaceSampleId } from "@/features/openapi-diff/data/workspace-samples";
import type { ReportExportFormat } from "@/features/openapi-diff/lib/report-export";
import type {
  AnalysisSettings,
  OpenApiAnalysisResult,
  SpecInput,
} from "@/features/openapi-diff/types";
import type { AnalyticsEvent } from "@/lib/analytics-core";

type RedactionUsageScope = "analysis_settings" | "custom_rule" | "export";

const TOOL_ID = "openapi_diff";

export function createSampleLoadedEvent(
  sampleId: WorkspaceSampleId,
): AnalyticsEvent {
  return {
    name: "sample_loaded",
    properties: {
      sample_id: sampleId,
      tool: TOOL_ID,
    },
  };
}

export function createAnalysisStartedEvent(input: {
  autoRunAnalysis: boolean;
  baseSpec: SpecInput;
  combinedBytes: number;
  largeWorkspaceFallbackActive: boolean;
  largestSpecBytes: number;
  revisionSpec: SpecInput;
  settings: AnalysisSettings;
}): AnalyticsEvent {
  return {
    name: "analysis_started",
    properties: {
      auto_run: input.autoRunAnalysis,
      base_format: input.baseSpec.format,
      base_source: input.baseSpec.source,
      combined_size_bucket: getSpecSizeBucket(input.combinedBytes),
      consumer_profile: input.settings.consumerProfile,
      has_custom_redaction_rules: input.settings.customRedactionRules.length > 0,
      has_ignore_rules: input.settings.ignoreRules.length > 0,
      large_workspace_fallback: input.largeWorkspaceFallbackActive,
      largest_size_bucket: getSpecSizeBucket(input.largestSpecBytes),
      redact_examples: input.settings.redactExamples,
      redact_server_urls: input.settings.redactServerUrls,
      resolve_local_refs: input.settings.resolveLocalRefs,
      revision_format: input.revisionSpec.format,
      revision_source: input.revisionSpec.source,
      tool: TOOL_ID,
    },
  };
}

export function createAnalysisCompletedEvent(input: {
  autoRunAnalysis: boolean;
  combinedBytes: number;
  largeWorkspaceFallbackActive: boolean;
  result: OpenApiAnalysisResult;
}): AnalyticsEvent {
  return {
    name: "analysis_completed",
    properties: {
      active_findings: input.result.report.summary.totalFindings,
      affected_endpoints: input.result.report.affectedEndpoints.length,
      affected_schemas: input.result.report.affectedSchemas.length,
      auto_run: input.autoRunAnalysis,
      breaking_count: input.result.report.summary.bySeverity.breaking,
      combined_size_bucket: getSpecSizeBucket(input.combinedBytes),
      consumer_profile: input.result.report.settings.consumerProfile,
      dangerous_count: input.result.report.summary.bySeverity.dangerous,
      diff_ms: Math.round(input.result.performance.diffMs),
      ignored_findings: input.result.report.summary.ignoredFindings,
      large_workspace_fallback: input.largeWorkspaceFallbackActive,
      normalize_ms: Math.round(input.result.performance.normalizeMs),
      parse_base_ms: Math.round(input.result.performance.parseBaseMs),
      parse_revision_ms: Math.round(input.result.performance.parseRevisionMs),
      recommendation: input.result.report.recommendation.code,
      ref_resolution_ms: Math.round(input.result.performance.refResolutionMs),
      report_ms: Math.round(input.result.performance.reportMs),
      risk_score: input.result.report.riskScore,
      safe_count: input.result.report.summary.bySeverity.safe,
      tool: TOOL_ID,
      total_ms: Math.round(input.result.performance.totalMs),
      validation_ms: Math.round(input.result.performance.validationMs),
    },
  };
}

export function createExportCopiedEvent(input: {
  detectedSecrets: boolean;
  format: ReportExportFormat;
  includedFindingCount: number;
  redacted: boolean;
}): AnalyticsEvent {
  return {
    name: "export_copied",
    properties: {
      detected_secrets: input.detectedSecrets,
      format: input.format,
      included_findings: input.includedFindingCount,
      redacted: input.redacted,
      tool: TOOL_ID,
    },
  };
}

export function createExportDownloadedEvent(input: {
  detectedSecrets: boolean;
  format: ReportExportFormat;
  includedFindingCount: number;
  redacted: boolean;
}): AnalyticsEvent {
  return {
    name: "export_downloaded",
    properties: {
      detected_secrets: input.detectedSecrets,
      format: input.format,
      included_findings: input.includedFindingCount,
      redacted: input.redacted,
      tool: TOOL_ID,
    },
  };
}

export function createRedactionUsedEvent(input: {
  customRuleCount: number;
  detectedSecrets: boolean;
  redactExamples: boolean;
  redactServerUrls: boolean;
  scope: RedactionUsageScope;
}): AnalyticsEvent {
  return {
    name: "redaction_used",
    properties: {
      custom_rule_count: input.customRuleCount,
      detected_secrets: input.detectedSecrets,
      redact_examples: input.redactExamples,
      redact_server_urls: input.redactServerUrls,
      scope: input.scope,
      tool: TOOL_ID,
    },
  };
}

function getSpecSizeBucket(bytes: number) {
  if (bytes <= 0) {
    return "empty";
  }

  if (bytes < 50 * 1024) {
    return "lt_50kb";
  }

  if (bytes < 250 * 1024) {
    return "50kb_to_250kb";
  }

  if (bytes < 1024 * 1024) {
    return "250kb_to_1mb";
  }

  if (bytes < 5 * 1024 * 1024) {
    return "1mb_to_5mb";
  }

  if (bytes < 10 * 1024 * 1024) {
    return "5mb_to_10mb";
  }

  return "gte_10mb";
}

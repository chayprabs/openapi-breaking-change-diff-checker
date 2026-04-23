import { TOOL_VERSION } from "@/lib/tool-version";
import type { DiffReport } from "@/features/openapi-diff/types";

export type FeedbackKind = "bug" | "correctness" | "idea";

export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export type FeedbackReportMetadata = {
  affectedEndpointCount: number;
  affectedSchemaCount: number;
  baselineFormat: string;
  baselinePathCount: number;
  baselineSchemaCount: number;
  baselineVersion: string;
  candidateFormat: string;
  candidatePathCount: number;
  candidateSchemaCount: number;
  candidateVersion: string;
  consumerProfile: string;
  customRedactionRuleCount: number;
  generatedAt: string;
  ignoredFindingCount: number;
  recommendation: string;
  redactExamples: boolean;
  redactServerUrls: boolean;
  riskScore: number;
  severityCounts: {
    breaking: number;
    dangerous: number;
    info: number;
    safe: number;
  };
  totalFindings: number;
};

export type OpenApiDiffFeedbackPayload = {
  email?: string;
  kind: FeedbackKind;
  message: string;
  page: "/tools/openapi-diff-breaking-changes";
  rating: FeedbackRating;
  reportMetadata?: FeedbackReportMetadata;
  tool: "openapi_diff";
  toolVersion: string;
};

export function createOpenApiDiffFeedbackPayload(input: {
  email?: string;
  includeReportMetadata: boolean;
  kind: FeedbackKind;
  message: string;
  rating: FeedbackRating;
  report: DiffReport | null;
}): OpenApiDiffFeedbackPayload {
  return {
    ...(input.email ? { email: input.email } : {}),
    kind: input.kind,
    message: input.message.trim(),
    page: "/tools/openapi-diff-breaking-changes",
    rating: input.rating,
    ...(input.includeReportMetadata && input.report
      ? { reportMetadata: createFeedbackReportMetadata(input.report) }
      : {}),
    tool: "openapi_diff",
    toolVersion: TOOL_VERSION,
  };
}

export function createFeedbackReportMetadata(
  report: DiffReport,
): FeedbackReportMetadata {
  return {
    affectedEndpointCount: report.affectedEndpoints.length,
    affectedSchemaCount: report.affectedSchemas.length,
    baselineFormat: report.baseline.input.format,
    baselinePathCount: report.baseline.pathCount,
    baselineSchemaCount: report.baseline.schemaCount,
    baselineVersion: report.baseline.version.label,
    candidateFormat: report.candidate.input.format,
    candidatePathCount: report.candidate.pathCount,
    candidateSchemaCount: report.candidate.schemaCount,
    candidateVersion: report.candidate.version.label,
    consumerProfile: report.settings.consumerProfile,
    customRedactionRuleCount: report.settings.customRedactionRules.length,
    generatedAt: report.generatedAt,
    ignoredFindingCount: report.summary.ignoredFindings,
    recommendation: report.recommendation.code,
    redactExamples: report.settings.redactExamples,
    redactServerUrls: report.settings.redactServerUrls,
    riskScore: report.riskScore,
    severityCounts: {
      ...report.summary.bySeverity,
    },
    totalFindings: report.summary.totalFindings,
  };
}

export function createFeedbackText(payload: OpenApiDiffFeedbackPayload) {
  const lines = [
    "Authos OpenAPI Diff feedback",
    "",
    `Rating: ${payload.rating}/5`,
    `Type: ${formatFeedbackKind(payload.kind)}`,
    `Tool version: ${payload.toolVersion}`,
    `Page: ${payload.page}`,
  ];

  if (payload.email) {
    lines.push(`Email: ${payload.email}`);
  }

  lines.push("", "Details:", payload.message);

  if (payload.reportMetadata) {
    lines.push(
      "",
      "Report metadata:",
      `- Recommendation: ${payload.reportMetadata.recommendation}`,
      `- Risk score: ${payload.reportMetadata.riskScore}`,
      `- Consumer profile: ${payload.reportMetadata.consumerProfile}`,
      `- Active findings: ${payload.reportMetadata.totalFindings}`,
      `- Ignored findings: ${payload.reportMetadata.ignoredFindingCount}`,
      `- Breaking: ${payload.reportMetadata.severityCounts.breaking}`,
      `- Dangerous: ${payload.reportMetadata.severityCounts.dangerous}`,
      `- Safe: ${payload.reportMetadata.severityCounts.safe}`,
      `- Info: ${payload.reportMetadata.severityCounts.info}`,
      `- Affected endpoints: ${payload.reportMetadata.affectedEndpointCount}`,
      `- Affected schemas: ${payload.reportMetadata.affectedSchemaCount}`,
      `- Base version: ${payload.reportMetadata.baselineVersion}`,
      `- Revision version: ${payload.reportMetadata.candidateVersion}`,
      `- Base paths/schemas: ${payload.reportMetadata.baselinePathCount}/${payload.reportMetadata.baselineSchemaCount}`,
      `- Revision paths/schemas: ${payload.reportMetadata.candidatePathCount}/${payload.reportMetadata.candidateSchemaCount}`,
      `- Redact examples: ${payload.reportMetadata.redactExamples ? "Yes" : "No"}`,
      `- Redact server URLs: ${payload.reportMetadata.redactServerUrls ? "Yes" : "No"}`,
      `- Custom redaction rules: ${payload.reportMetadata.customRedactionRuleCount}`,
      `- Generated at: ${payload.reportMetadata.generatedAt}`,
    );
  }

  lines.push("", "Note: Raw specs, finding details, URLs inside specs, and report bodies are not attached automatically.");

  return lines.join("\n");
}

export function createFeedbackMailtoHref(
  emailAddress: string,
  payload: OpenApiDiffFeedbackPayload,
) {
  const subject = `[Authos Feedback] ${formatFeedbackKind(payload.kind)} (${payload.rating}/5)`;
  const body = createFeedbackText(payload);

  return `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function getFeedbackDeliveryMode(input: {
  feedbackEmail?: string | null;
  feedbackEndpoint?: string | null;
}) {
  if (input.feedbackEndpoint?.trim()) {
    return "api";
  }

  if (input.feedbackEmail?.trim()) {
    return "mailto";
  }

  return "copy";
}

export function looksLikeRawSpecContent(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  const matches = [
    /(^|\n)\s*openapi\s*:/m,
    /(^|\n)\s*swagger\s*:/m,
    /(^|\n)\s*paths\s*:/m,
    /(^|\n)\s*components\s*:/m,
    /(^|\n)\s*responses\s*:/m,
    /(^|\n)\s*requestbody\s*:/m,
    /"openapi"\s*:/,
    /"swagger"\s*:/,
    /"paths"\s*:/,
    /"components"\s*:/,
  ].filter((pattern) => pattern.test(normalized)).length;
  const lineCount = trimmed.split(/\r?\n/).length;

  return matches >= 3 || (matches >= 2 && lineCount >= 12) || trimmed.length > 4_000;
}

export function normalizeFeedbackEmail(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

function formatFeedbackKind(kind: FeedbackKind) {
  if (kind === "correctness") {
    return "Correctness issue";
  }

  if (kind === "idea") {
    return "Idea";
  }

  return "Bug";
}

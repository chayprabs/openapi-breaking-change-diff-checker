import { z } from "zod";
import {
  buildDiffSummary,
  diffSeverityOrder,
  sortDiffFindings,
} from "@/features/openapi-diff/engine/diff-support";
import {
  cloneAnalysisSettings,
  createAnalysisSettings,
  formatConsumerProfileLabel,
} from "@/features/openapi-diff/lib/analysis-settings";
import {
  getIgnoreRuleLabel,
  matchesIgnoreRule,
} from "@/features/openapi-diff/lib/ignore-rules";
import type {
  AnalysisSettings,
  ConsumerProfile,
  DiffFinding,
  DiffReport,
  DiffReportAffectedEndpoint,
  DiffReportAffectedSchema,
  DiffReportRecommendation,
  DiffReportReviewItem,
  DiffReportSummary,
  DiffSeverity,
  JsonValue,
  OpenApiHttpMethod,
  ParsedSpec,
  RedactionMatch,
  RedactionPlaceholderKind,
  RedactionPreview,
  RedactionResult,
  RemoteRefPolicy,
  RuleId,
} from "@/features/openapi-diff/types";

type BuildReportOptions = {
  generatedAt?: string;
  redaction?: RedactionResult;
  warnings?: readonly string[];
};

const consumerProfileValues = [
  "publicApi",
  "internalApi",
  "sdkStrict",
  "mobileClient",
  "tolerantClient",
] as const satisfies readonly ConsumerProfile[];

const diffCategoryValues = [
  "path",
  "operation",
  "parameter",
  "requestBody",
  "response",
  "schema",
  "enum",
  "security",
  "docs",
  "metadata",
] as const;

const diffSeverityValues = [
  "breaking",
  "dangerous",
  "safe",
  "info",
] as const satisfies readonly DiffSeverity[];

const exportFormatValues = ["json", "markdown", "html", "csv"] as const;
const remoteRefPolicyValues = [
  "localOnly",
  "publicRemote",
] as const satisfies readonly RemoteRefPolicy[];
const redactionPlaceholderKinds = [
  "API_KEY",
  "BASIC_AUTH",
  "CUSTOM",
  "EMAIL",
  "EXAMPLE",
  "INTERNAL_DOMAIN",
  "JWT",
  "PASSWORD",
  "PRIVATE_IP",
  "PRIVATE_KEY",
  "SECRET",
  "SERVER_URL",
  "TOKEN",
] as const satisfies readonly RedactionPlaceholderKind[];
const openApiVersionFamilyValues = [
  "swagger-2.0",
  "openapi-3.0.x",
  "openapi-3.1.x",
  "unknown",
] as const;
const openApiHttpMethodValues = [
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
] as const satisfies readonly OpenApiHttpMethod[];
const parserImplementationValues = ["lightweight", "scalar"] as const;
const parserIssueSourceValues = [
  "diff",
  "json",
  "normalize",
  "openapi",
  "scalar",
  "worker",
  "yaml",
] as const;
const reportRecommendationLabels = {
  blockRelease: "Block release",
  likelySafe: "Likely safe",
  reviewBeforeRelease: "Review before release",
} as const satisfies Record<
  DiffReportRecommendation["code"],
  DiffReportRecommendation["label"]
>;
const sdkImpactRuleIds = new Set<RuleId>([
  "operationId.changed",
  "parameter.schema.changed",
  "request.body.schema.changed",
  "response.mediaType.added",
  "response.mediaType.removed",
  "response.schema.changed",
  "response.status.added",
  "response.status.removed",
  "schema.allOf.changed",
  "schema.anyOf.changed",
  "schema.discriminator.changed",
  "schema.enum.value.added",
  "schema.enum.value.removed",
  "schema.feature.unsupported",
  "schema.nullable.changed",
  "schema.oneOf.changed",
  "schema.property.added.optional",
  "schema.property.removed",
  "schema.readOnly.changed",
  "schema.required.added",
  "schema.required.removed",
  "schema.type.changed",
  "schema.writeOnly.changed",
]);

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy((): z.ZodType<JsonValue> =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const parserIssueSchema = z.object({
  code: z.string().min(1),
  column: z.number().int().positive().optional(),
  editorId: z.enum(["base", "revision"]).optional(),
  line: z.number().int().positive().optional(),
  message: z.string().min(1),
  offset: z.number().int().nonnegative().optional(),
  source: z.enum(parserIssueSourceValues),
});

const parsedSpecSchema = z.object({
  byteCount: z.number().int().nonnegative(),
  componentsOnly: z.boolean(),
  externalRefCount: z.number().int().nonnegative(),
  input: z.object({
    filename: z.string().min(1).optional(),
    format: z.enum(["json", "yaml"]),
    id: z.string().min(1),
    label: z.string().min(1),
    source: z.enum(["paste", "sample", "upload", "url"]),
    url: z.string().min(1).optional(),
  }),
  lineCount: z.number().int().nonnegative(),
  localRefCount: z.number().int().nonnegative(),
  pathCount: z.number().int().nonnegative(),
  schemaCount: z.number().int().nonnegative(),
  unresolvedRefs: z.array(z.string()),
  validationSource: z.enum(parserImplementationValues),
  version: z.object({
    family: z.enum(openApiVersionFamilyValues),
    label: z.string().min(1),
    raw: z.string().min(1).optional(),
    sourceField: z.enum(["openapi", "swagger", "unknown"]),
    supported: z.boolean(),
  }),
  warnings: z.array(parserIssueSchema),
});

const analysisSettingsSchema = z.object({
  customRedactionRules: z.array(
    z.object({
      flags: z.string().optional(),
      id: z.string().min(1),
      label: z.string().min(1).optional(),
      pattern: z.string().min(1),
    }),
  ),
  consumerProfile: z.enum(consumerProfileValues),
  exportFormats: z.array(z.enum(exportFormatValues)),
  failOnSeverities: z.array(z.enum(diffSeverityValues)),
  ignoreRules: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1).optional(),
      consumerProfiles: z.array(z.enum(consumerProfileValues)).optional(),
      expiresAt: z.string().min(1).optional(),
      findingId: z.string().min(1).optional(),
      jsonPathPrefix: z.string().min(1).optional(),
      method: z.enum(openApiHttpMethodValues).optional(),
      operationId: z.string().min(1).optional(),
      pathPattern: z.string().min(1).optional(),
      reason: z.string().min(1),
      ruleId: z.string().min(1).optional(),
      source: z.enum([
        "deprecatedEndpoint",
        "docsOnly",
        "finding",
        "method",
        "operationId",
        "pathPattern",
        "ruleId",
        "tag",
      ]),
      tag: z.string().min(1).optional(),
    }),
  ),
  includeCategories: z.array(z.enum(diffCategoryValues)),
  includeInfoFindings: z.boolean(),
  redactExamples: z.boolean(),
  redactServerUrls: z.boolean(),
  remoteRefPolicy: z.enum(remoteRefPolicyValues),
  resolveLocalRefs: z.boolean(),
  treatEnumAdditionsAsDangerous: z.boolean(),
});

const diffFindingSchema = z.object({
  afterValue: jsonValueSchema.nullable(),
  baseSeverity: z.enum(diffSeverityValues),
  beforeValue: jsonValueSchema.nullable(),
  category: z.enum(diffCategoryValues),
  classificationContext: z
    .object({
      parameterLocation: z.string().min(1).optional(),
      schemaDirection: z
        .enum(["component", "parameter", "request", "response", "unknown"])
        .optional(),
    })
    .optional(),
  consumerProfiles: z.array(z.enum(consumerProfileValues)).optional(),
  evidence: z.object({
    base: z
      .object({
        jsonPointer: z.string().min(1),
        node: z.object({
          originPath: z.string().min(1),
          originalPointer: z.string().min(1).optional(),
          refChain: z.array(z.string()),
          resolvedPointer: z.string().min(1).optional(),
          sourcePath: z.string().min(1),
        }),
      })
      .optional(),
    revision: z
      .object({
        jsonPointer: z.string().min(1),
        node: z.object({
          originPath: z.string().min(1),
          originalPointer: z.string().min(1).optional(),
          refChain: z.array(z.string()),
          resolvedPointer: z.string().min(1).optional(),
          sourcePath: z.string().min(1),
        }),
      })
      .optional(),
  }),
  humanPath: z.string().min(1).optional(),
  id: z.string().min(1),
  ignored: z.boolean().optional(),
  ignoredBy: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        reason: z.string().min(1),
        source: z.enum([
          "deprecatedEndpoint",
          "docsOnly",
          "finding",
          "method",
          "operationId",
          "pathPattern",
          "ruleId",
          "tag",
        ]),
      }),
    )
    .optional(),
  jsonPointer: z.string().min(1),
  message: z.string().min(1),
  method: z.enum(openApiHttpMethodValues).nullable(),
  operationDeprecated: z.boolean().optional(),
  operationId: z.string().min(1).optional(),
  path: z.string().min(1).nullable(),
  ruleId: z.string().min(1),
  saferAlternative: z.string().min(1).optional(),
  severity: z.enum(diffSeverityValues),
  severityReason: z.string().min(1),
  tags: z.array(z.string().min(1)).optional(),
  title: z.string().min(1),
  whyItMatters: z.string().min(1),
});

const diffReportSchema = z.object({
  affectedEndpoints: z.array(
    z.object({
      findingCount: z.number().int().positive(),
      highestSeverity: z.enum(diffSeverityValues),
      key: z.string().min(1),
      method: z.enum(openApiHttpMethodValues).nullable(),
      path: z.string().min(1),
      ruleIds: z.array(z.string().min(1)),
    }),
  ),
  affectedSchemas: z.array(
    z.object({
      findingCount: z.number().int().positive(),
      highestSeverity: z.enum(diffSeverityValues),
      humanPaths: z.array(z.string().min(1)),
      jsonPointers: z.array(z.string().min(1)),
      key: z.string().min(1),
      label: z.string().min(1),
      ruleIds: z.array(z.string().min(1)),
    }),
  ),
  baseline: parsedSpecSchema,
  candidate: parsedSpecSchema,
  executiveSummary: z.string().min(1),
  findings: z.array(diffFindingSchema),
  generatedAt: z.string().min(1),
  migrationNotes: z.array(z.string().min(1)),
  recommendation: z.object({
    code: z.enum(["blockRelease", "reviewBeforeRelease", "likelySafe"]),
    label: z.enum(["Block release", "Review before release", "Likely safe"]),
    reason: z.string().min(1),
  }),
  redaction: z
    .object({
      detectedSecrets: z.boolean(),
      matches: z.array(
        z.object({
          id: z.string().min(1),
          kind: z.enum(redactionPlaceholderKinds),
          occurrences: z.number().int().positive(),
          placeholder: z.string().min(1),
          preview: z.string(),
          reason: z.string().min(1),
          sourceLabels: z.array(z.string().min(1)),
        }),
      ),
      previews: z.array(
        z.object({
          after: z.string(),
          before: z.string(),
          id: z.string().min(1),
          kind: z.enum(redactionPlaceholderKinds),
          placeholder: z.string().min(1),
          sourceLabel: z.string().min(1),
        }),
      ),
      redactedKeys: z.array(z.string().min(1)),
      redactedSource: z.string().min(1),
      replacements: z.number().int().nonnegative(),
      warnings: z.array(z.string().min(1)),
    })
    .optional(),
  riskScore: z.number().int().min(0).max(100),
  sdkImpactSummary: z.string().min(1),
  securitySummary: z.string().min(1),
  settings: analysisSettingsSchema,
  successState: z
    .object({
      emphasis: z.enum(["info", "success"]),
      message: z.string().min(1),
      title: z.literal("No breaking changes found"),
    })
    .nullable(),
  summary: z.object({
    byCategory: z.object({
      docs: z.number().int().nonnegative(),
      operations: z.number().int().nonnegative(),
      parameters: z.number().int().nonnegative(),
      paths: z.number().int().nonnegative(),
      responses: z.number().int().nonnegative(),
      schemas: z.number().int().nonnegative(),
      security: z.number().int().nonnegative(),
    }),
    bySeverity: z.object({
      breaking: z.number().int().nonnegative(),
      dangerous: z.number().int().nonnegative(),
      info: z.number().int().nonnegative(),
      safe: z.number().int().nonnegative(),
    }),
    ignoredFindings: z.number().int().nonnegative(),
    totalFindings: z.number().int().nonnegative(),
  }),
  topReviewItems: z
    .array(
      z.object({
        id: z.string().min(1),
        jsonPointer: z.string().min(1),
        message: z.string().min(1),
        method: z.enum(openApiHttpMethodValues).nullable(),
        path: z.string().min(1).nullable(),
        severity: z.enum(diffSeverityValues),
        title: z.string().min(1),
      }),
    )
    .max(5),
  warnings: z.array(z.string()),
});

export function buildReport(
  baseline: ParsedSpec,
  candidate: ParsedSpec,
  findings: readonly DiffFinding[],
  settings: AnalysisSettings,
  options: BuildReportOptions = {},
): DiffReport {
  const normalizedSettings = createAnalysisSettings(settings);
  const sortedFindings = sortDiffFindings(findings);
  const activeFindings = sortedFindings.filter((finding) => !finding.ignored);
  const summary = buildDiffSummary(sortedFindings);
  const affectedEndpoints = buildAffectedEndpoints(activeFindings);
  const affectedSchemas = buildAffectedSchemas(activeFindings);
  const securityFindingCount = activeFindings.filter(
    (finding) => finding.category === "security",
  ).length;
  const sdkFindingCount = activeFindings.filter(isSdkRelevantFinding).length;
  const recommendation = buildRecommendation(summary);
  const riskScore = buildRiskScore(
    summary,
    affectedEndpoints.length,
    affectedSchemas.length,
    securityFindingCount,
    sdkFindingCount,
  );
  const successState = buildSuccessState(summary);
  const securitySummary = buildSecuritySummary(activeFindings);
  const sdkImpactSummary = buildSdkImpactSummary(
    activeFindings,
    normalizedSettings.consumerProfile,
  );
  const migrationNotes = buildMigrationNotes(activeFindings);
  const topReviewItems = buildTopReviewItems(activeFindings);
  const warnings = sortUniqueStrings([
    ...(options.warnings ?? []),
    ...buildIgnoreWarnings(sortedFindings, normalizedSettings),
  ]);
  const report: DiffReport = {
    affectedEndpoints,
    affectedSchemas,
    baseline,
    candidate,
    executiveSummary: buildExecutiveSummary(
      summary,
      recommendation,
      affectedEndpoints,
      affectedSchemas,
      normalizedSettings.consumerProfile,
    ),
    findings: sortedFindings,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    migrationNotes,
    recommendation,
    riskScore,
    sdkImpactSummary,
    securitySummary,
    settings: cloneAnalysisSettings(normalizedSettings),
    successState,
    summary,
    topReviewItems,
    warnings,
    ...(options.redaction ? { redaction: cloneRedactionResult(options.redaction) } : {}),
  };

  diffReportSchema.parse(report);
  return report;
}

export { diffReportSchema };

function buildAffectedEndpoints(
  findings: readonly DiffFinding[],
): DiffReportAffectedEndpoint[] {
  const groups = new Map<string, DiffReportAffectedEndpoint>();

  for (const finding of findings) {
    if (!finding.path) {
      continue;
    }

    const key = `${finding.path}::${finding.method ?? ""}`;
    const current = groups.get(key);

    if (current) {
      current.findingCount += 1;
      current.highestSeverity = pickHigherSeverity(
        current.highestSeverity,
        finding.severity,
      );
      current.ruleIds = sortUniqueValues<RuleId>([...current.ruleIds, finding.ruleId]);
      continue;
    }

    const nextGroup: DiffReportAffectedEndpoint = {
      findingCount: 1,
      highestSeverity: finding.severity,
      key,
      method: finding.method,
      path: finding.path,
      ruleIds: [finding.ruleId],
    };

    groups.set(key, nextGroup);
  }

  return [...groups.values()].sort(compareAffectedEndpoints);
}

function buildAffectedSchemas(
  findings: readonly DiffFinding[],
): DiffReportAffectedSchema[] {
  const groups = new Map<string, DiffReportAffectedSchema>();

  for (const finding of findings) {
    const label = extractSchemaLabel(finding);

    if (!label) {
      continue;
    }

    const key = normalizeSchemaKey(label);
    const current = groups.get(key);

    if (current) {
      current.findingCount += 1;
      current.highestSeverity = pickHigherSeverity(
        current.highestSeverity,
        finding.severity,
      );
      current.humanPaths = sortUniqueStrings([
        ...current.humanPaths,
        ...(finding.humanPath ? [finding.humanPath] : []),
      ]);
      current.jsonPointers = sortUniqueStrings([
        ...current.jsonPointers,
        finding.jsonPointer,
      ]);
      current.ruleIds = sortUniqueValues<RuleId>([...current.ruleIds, finding.ruleId]);
      continue;
    }

    const nextGroup: DiffReportAffectedSchema = {
      findingCount: 1,
      highestSeverity: finding.severity,
      humanPaths: sortUniqueStrings(finding.humanPath ? [finding.humanPath] : []),
      jsonPointers: [finding.jsonPointer],
      key,
      label,
      ruleIds: [finding.ruleId],
    };

    groups.set(key, nextGroup);
  }

  return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function buildExecutiveSummary(
  summary: DiffReportSummary,
  recommendation: DiffReportRecommendation,
  affectedEndpoints: readonly DiffReportAffectedEndpoint[],
  affectedSchemas: readonly DiffReportAffectedSchema[],
  consumerProfile: ConsumerProfile,
) {
  const profileLabel = formatConsumerProfileLabel(consumerProfile);
  const endpointPhrase = countLabel(affectedEndpoints.length, "affected endpoint");
  const schemaPhrase = countLabel(affectedSchemas.length, "affected schema");

  if (summary.totalFindings === 0) {
    return summary.ignoredFindings > 0
      ? `No active semantic contract changes remain for the ${profileLabel} profile, but ${countLabel(summary.ignoredFindings, "ignored finding")} is still available for audit.`
      : `No semantic contract changes were detected for the ${profileLabel} profile. This comparison is likely safe to release.`;
  }

  if (recommendation.code === "blockRelease") {
    return `This comparison found ${summary.bySeverity.breaking} breaking and ${summary.bySeverity.dangerous} dangerous changes across ${endpointPhrase} and ${schemaPhrase}. Existing consumers can fail without coordination, so the recommendation is to block release.${buildIgnoredSummarySuffix(summary)}`;
  }

  if (recommendation.code === "reviewBeforeRelease") {
    return `No breaking changes were found for the ${profileLabel} profile, but ${summary.bySeverity.dangerous} dangerous changes still affect ${endpointPhrase} and ${schemaPhrase}. Review rollout risk before release.${buildIgnoredSummarySuffix(summary)}`;
  }

  if (summary.bySeverity.safe || summary.bySeverity.info) {
    return `Only safe or informational changes were detected for the ${profileLabel} profile across ${endpointPhrase} and ${schemaPhrase}. This release is likely safe with normal verification.${buildIgnoredSummarySuffix(summary)}`;
  }

  return `The report did not find release-blocking compatibility issues for the ${profileLabel} profile. This release is likely safe.${buildIgnoredSummarySuffix(summary)}`;
}

function buildIgnoredSummarySuffix(summary: DiffReportSummary) {
  return summary.ignoredFindings > 0
    ? ` ${countLabel(summary.ignoredFindings, "ignored finding")} remains available in the Ignored tab.`
    : "";
}

function buildMigrationNotes(findings: readonly DiffFinding[]) {
  const suggestions = sortUniqueStrings(
    findings
      .map((finding) => finding.saferAlternative?.trim())
      .filter((note): note is string => Boolean(note)),
  ).slice(0, 5);

  if (suggestions.length > 0) {
    return suggestions;
  }

  if (!findings.length) {
    return ["No migration work is suggested because no semantic contract changes were detected."];
  }

  if (findings.some((finding) => finding.severity === "breaking")) {
    return ["Coordinate a versioning or compatibility rollout plan before shipping the breaking changes in this report."];
  }

  if (findings.some((finding) => finding.severity === "dangerous")) {
    return ["Review client rollout notes, SDK regeneration, and staged release steps before shipping the dangerous changes in this report."];
  }

  return ["No special migration work is suggested beyond routine verification for the detected safe and informational changes."];
}

function buildRecommendation(summary: DiffReportSummary): DiffReportRecommendation {
  if (summary.bySeverity.breaking > 0) {
    return {
      code: "blockRelease",
      label: reportRecommendationLabels.blockRelease,
      reason: `${countLabel(summary.bySeverity.breaking, "breaking finding")} can fail existing consumers or integrations immediately.`,
    };
  }

  if (summary.bySeverity.dangerous > 0) {
    return {
      code: "reviewBeforeRelease",
      label: reportRecommendationLabels.reviewBeforeRelease,
      reason: `${countLabel(summary.bySeverity.dangerous, "dangerous finding")} still needs review before release because rollout or client tolerance may be risky.`,
    };
  }

  return {
    code: "likelySafe",
    label: reportRecommendationLabels.likelySafe,
    reason:
      summary.totalFindings === 0
        ? "No semantic contract changes were detected."
        : "Only safe and informational findings remain for the selected compatibility profile.",
  };
}

function buildIgnoreWarnings(
  findings: readonly DiffFinding[],
  settings: AnalysisSettings,
) {
  if (!findings.length || settings.ignoreRules.length === 0) {
    return [];
  }

  const warnings: string[] = [];
  const breakingFindings = findings.filter((finding) => finding.severity === "breaking");

  for (const ignoreRule of settings.ignoreRules) {
    const matchedFindings = findings.filter((finding) =>
      matchesIgnoreRule(ignoreRule, finding, settings.consumerProfile),
    );

    if (!matchedFindings.length) {
      continue;
    }

    const ruleLabel = getIgnoreRuleLabel(ignoreRule);
    const matchedBreaking = matchedFindings.filter(
      (finding) => finding.severity === "breaking",
    );

    if (
      breakingFindings.length > 0 &&
      matchedBreaking.length === breakingFindings.length
    ) {
      warnings.push(
        `${ruleLabel} hides all breaking findings in the current report. Review the Ignored tab before treating this diff as safe.`,
      );
    }

    if (
      matchedFindings.length === findings.length ||
      (findings.length >= 5 &&
        matchedFindings.length / findings.length >= 0.6) ||
      matchedFindings.length >= 12
    ) {
      warnings.push(
        `${ruleLabel} matches ${countLabel(matchedFindings.length, "finding")}, which is broad enough to deserve a manual sanity check.`,
      );
    }
  }

  return warnings;
}

function buildRiskScore(
  summary: DiffReportSummary,
  affectedEndpointCount: number,
  affectedSchemaCount: number,
  securityFindingCount: number,
  sdkFindingCount: number,
) {
  if (summary.totalFindings === 0) {
    return 0;
  }

  const score =
    summary.bySeverity.breaking * 35 +
    summary.bySeverity.dangerous * 14 +
    summary.bySeverity.safe * 3 +
    summary.bySeverity.info +
    Math.min(affectedEndpointCount, 5) * 4 +
    Math.min(affectedSchemaCount, 5) * 3 +
    Math.min(securityFindingCount, 3) * 5 +
    Math.min(sdkFindingCount, 4) * 3;

  return Math.min(100, Math.round(score));
}

function buildSdkImpactSummary(
  findings: readonly DiffFinding[],
  consumerProfile: ConsumerProfile,
) {
  const sdkFindings = findings.filter(isSdkRelevantFinding);

  if (!sdkFindings.length) {
    return "No strong SDK regeneration signals were detected from the current findings.";
  }

  const titles = sortUniqueStrings(
    sdkFindings.map((finding) => finding.title),
  ).slice(0, 3);
  const impactLevel = sdkFindings.some((finding) => finding.severity === "breaking")
    ? "high"
    : sdkFindings.some((finding) => finding.severity === "dangerous")
      ? "moderate"
      : "low";
  const profileClause =
    consumerProfile === "sdkStrict"
      ? " The current profile already assumes strict generated clients."
      : "";

  return `Generated SDK impact looks ${impactLevel}: ${countLabel(
    sdkFindings.length,
    "finding",
  )} point to typed model, enum, response-shape, or method-name updates. Review ${titles.join(", ")} before regenerating clients.${profileClause}`;
}

function buildSecuritySummary(findings: readonly DiffFinding[]) {
  const securityFindings = findings.filter((finding) => finding.category === "security");

  if (!securityFindings.length) {
    return "No auth or security contract changes were detected.";
  }

  const endpointCount = buildAffectedEndpoints(securityFindings).length;
  const changes: string[] = [];

  if (securityFindings.some((finding) => finding.ruleId === "security.requirement.added")) {
    changes.push("new security requirements were added");
  }

  if (securityFindings.some((finding) => finding.ruleId === "security.requirement.removed")) {
    changes.push("some security requirements were removed");
  }

  if (securityFindings.some((finding) => finding.ruleId === "security.scope.added")) {
    changes.push("OAuth scopes were expanded");
  }

  if (securityFindings.some((finding) => finding.ruleId === "security.scope.removed")) {
    changes.push("OAuth scopes were reduced");
  }

  const detail = changes.length ? changes.join("; ") : "security requirements changed";

  return `Detected ${countLabel(
    securityFindings.length,
    "auth/security finding",
  )} across ${countLabel(endpointCount, "endpoint")}: ${detail}.`;
}

function buildSuccessState(summary: DiffReportSummary): DiffReport["successState"] {
  if (summary.bySeverity.breaking > 0) {
    return null;
  }

  if (summary.bySeverity.dangerous > 0) {
    return {
      emphasis: "info",
      message: `${countLabel(summary.bySeverity.dangerous, "dangerous finding")} still needs review before release.`,
      title: "No breaking changes found",
    };
  }

  if (summary.totalFindings === 0) {
    return {
      emphasis: "success",
      message: "No semantic contract changes were detected in the current comparison.",
      title: "No breaking changes found",
    };
  }

  return {
    emphasis: "success",
    message: "Only safe and informational changes remain for the selected compatibility profile.",
    title: "No breaking changes found",
  };
}

function buildTopReviewItems(findings: readonly DiffFinding[]): DiffReportReviewItem[] {
  return findings.slice(0, 5).map((finding) => ({
    id: finding.id,
    jsonPointer: finding.jsonPointer,
    message: finding.message,
    method: finding.method,
    path: finding.path,
    severity: finding.severity,
    title: finding.title,
  }));
}

function cloneRedactionResult(redaction: RedactionResult): RedactionResult {
  return {
    detectedSecrets: redaction.detectedSecrets,
    matches: redaction.matches.map(cloneRedactionMatch),
    previews: redaction.previews.map(cloneRedactionPreview),
    redactedKeys: [...redaction.redactedKeys],
    redactedSource: redaction.redactedSource,
    replacements: redaction.replacements,
    warnings: [...redaction.warnings],
  };
}

function cloneRedactionMatch(redactionMatch: RedactionMatch): RedactionMatch {
  return {
    id: redactionMatch.id,
    kind: redactionMatch.kind,
    occurrences: redactionMatch.occurrences,
    placeholder: redactionMatch.placeholder,
    preview: redactionMatch.preview,
    reason: redactionMatch.reason,
    sourceLabels: [...redactionMatch.sourceLabels],
  };
}

function cloneRedactionPreview(redactionPreview: RedactionPreview): RedactionPreview {
  return {
    after: redactionPreview.after,
    before: redactionPreview.before,
    id: redactionPreview.id,
    kind: redactionPreview.kind,
    placeholder: redactionPreview.placeholder,
    sourceLabel: redactionPreview.sourceLabel,
  };
}

function compareAffectedEndpoints(
  left: DiffReportAffectedEndpoint,
  right: DiffReportAffectedEndpoint,
) {
  const pathDelta = left.path.localeCompare(right.path);

  if (pathDelta !== 0) {
    return pathDelta;
  }

  return (left.method ?? "").localeCompare(right.method ?? "");
}

function countLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function extractSchemaLabel(finding: DiffFinding) {
  if (!isSchemaFinding(finding)) {
    return null;
  }

  const pointers = [
    finding.jsonPointer,
    finding.evidence.base?.node.originalPointer,
    finding.evidence.base?.node.resolvedPointer,
    finding.evidence.base?.node.sourcePath,
    finding.evidence.revision?.node.originalPointer,
    finding.evidence.revision?.node.resolvedPointer,
    finding.evidence.revision?.node.sourcePath,
  ];

  for (const pointer of pointers) {
    const componentName = extractComponentSchemaName(pointer);

    if (componentName) {
      return componentName;
    }
  }

  if (finding.humanPath) {
    const trailingToken = finding.humanPath.trim().split(/\s+/).at(-1) ?? finding.humanPath;
    const cleanedTrailingToken = trailingToken.replace(/\[\]$/, "");

    if (
      cleanedTrailingToken &&
      !cleanedTrailingToken.includes("/") &&
      !cleanedTrailingToken.includes(":") &&
      !cleanedTrailingToken.startsWith("application/")
    ) {
      if (cleanedTrailingToken.includes(".")) {
        return cleanedTrailingToken.split(".")[0] ?? finding.humanPath;
      }

      return cleanedTrailingToken;
    }

    return finding.humanPath;
  }

  return null;
}

function extractComponentSchemaName(pointer: string | undefined) {
  if (!pointer) {
    return null;
  }

  const match = pointer.match(/#\/components\/schemas\/([^/]+)/);

  return match?.[1] ? decodePointerSegment(match[1]) : null;
}

function decodePointerSegment(segment: string) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function isSchemaFinding(finding: DiffFinding) {
  return (
    finding.category === "schema" ||
    finding.category === "enum" ||
    finding.ruleId === "parameter.schema.changed" ||
    finding.ruleId === "request.body.schema.changed" ||
    finding.ruleId === "response.schema.changed"
  );
}

function isSdkRelevantFinding(finding: DiffFinding) {
  return sdkImpactRuleIds.has(finding.ruleId);
}

function normalizeSchemaKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

function pickHigherSeverity(current: DiffSeverity, next: DiffSeverity): DiffSeverity {
  return severityRank(next) < severityRank(current) ? next : current;
}

function severityRank(severity: DiffSeverity) {
  const index = diffSeverityOrder.indexOf(severity);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortUniqueStrings(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sortUniqueValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

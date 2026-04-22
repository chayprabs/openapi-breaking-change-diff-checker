import { ruleCatalog } from "@/features/openapi-diff/data/rule-catalog";
import {
  buildDiffSummary,
  sortDiffFindings,
} from "@/features/openapi-diff/engine/diff-support";
import {
  cloneAnalysisSettings,
  createAnalysisSettings,
  formatConsumerProfileLabel,
} from "@/features/openapi-diff/lib/analysis-settings";
import type {
  AnalysisSettings,
  ConsumerProfile,
  DiffFinding,
  DiffReport,
  DiffSeverity,
  RuleMetadata,
  RuleId,
  SchemaDiffDirection,
} from "@/features/openapi-diff/types";

const ADDITIVE_RESPONSE_RULE_IDS = new Set<RuleId>([
  "response.default.added",
  "response.mediaType.added",
  "response.status.added",
]);
const ALL_PROFILE_BREAKING_RULE_IDS = new Set<RuleId>([
  "operation.removed",
  "parameter.required.added",
  "parameter.required.changed.toRequired",
  "path.removed",
  "request.body.required.added",
  "request.body.required.changed.toRequired",
  "security.requirement.added",
]);

type ClassificationResult = {
  severity: DiffSeverity;
  severityReason: string;
  whyItMatters?: string;
};

export function applyAnalysisSettingsToFindings(
  findings: readonly DiffFinding[],
  settings: AnalysisSettings,
) {
  const normalizedSettings = createAnalysisSettings(settings);

  return findings
    .map((finding) => classifyChange(finding, normalizedSettings))
    .filter((finding) => shouldIncludeFinding(finding, normalizedSettings));
}

export function classifyChange(
  change: DiffFinding,
  settings: AnalysisSettings,
): DiffFinding {
  const normalizedSettings = createAnalysisSettings(settings);
  const rule = getRuleMetadata(change.ruleId);
  const baseSeverity = change.baseSeverity ?? change.severity ?? rule.defaultSeverity;
  const classification = classifyByProfile(change, rule, baseSeverity, normalizedSettings);

  return {
    ...change,
    baseSeverity,
    severity: classification.severity,
    severityReason: classification.severityReason,
    whyItMatters: classification.whyItMatters ?? change.whyItMatters ?? rule.whyItMatters,
  };
}

export function getRuleMetadata(ruleId: RuleId): RuleMetadata & { id: RuleId } {
  return ruleCatalog[ruleId];
}

export function reclassifyDiffReport(
  report: DiffReport,
  settings: AnalysisSettings,
): DiffReport {
  const normalizedSettings = createAnalysisSettings(settings);
  const findings = sortDiffFindings(
    applyAnalysisSettingsToFindings(report.findings, normalizedSettings),
  );

  return {
    ...report,
    findings,
    settings: cloneAnalysisSettings(normalizedSettings),
    summary: buildDiffSummary(findings),
  };
}

function classifyByProfile(
  change: DiffFinding,
  rule: RuleMetadata,
  baseSeverity: DiffSeverity,
  settings: AnalysisSettings,
): ClassificationResult {
  const profile = settings.consumerProfile;
  const parameterLocation = change.classificationContext?.parameterLocation;
  const schemaDirection = getSchemaDirection(change);

  if (ALL_PROFILE_BREAKING_RULE_IDS.has(change.ruleId)) {
    return {
      severity: "breaking",
      severityReason:
        change.ruleId === "parameter.required.added" && parameterLocation
          ? `All profiles keep this at breaking because existing callers do not know to send the new required ${parameterLocation} parameter.`
          : `All profiles keep this at breaking because existing clients can fail immediately when this newly required behavior is rolled out.`,
    };
  }

  if (change.ruleId === "operationId.changed") {
    if (profile === "internalApi" || profile === "tolerantClient") {
      return {
        severity: "info",
        severityReason: `The ${formatConsumerProfileLabel(profile)} profile lowers this from ${baseSeverity} to info because operationId renames usually affect docs and code generation more than wire compatibility for coordinated consumers.`,
      };
    }

    if (profile === "sdkStrict") {
      return {
        severity: "dangerous",
        severityReason:
          "The SDK strict profile keeps this at dangerous because generated method names and stable SDK entry points often come directly from operationId.",
        whyItMatters:
          "SDK generators and client method names often treat operationId as a stable API surface, so renames can become source-breaking even when the wire contract stays similar.",
      };
    }
  }

  if (change.ruleId === "schema.enum.value.added") {
    if (schemaDirection === "parameter" || schemaDirection === "request") {
      if (profile === "sdkStrict") {
        return {
          severity: "dangerous",
          severityReason:
            "The SDK strict profile keeps widened input enums at dangerous because generated enum types and validators still change even when the server accepts more values.",
        };
      }

      return {
        severity: "safe",
        severityReason: `The ${formatConsumerProfileLabel(profile)} profile lowers this to safe because widening accepted input values is usually additive for callers.`,
      };
    }

    if (schemaDirection === "response") {
      if (profile === "sdkStrict") {
        return {
          severity: "breaking",
          severityReason:
            "The SDK strict profile raises this to breaking because generated enums and exhaustive switches often fail when a response starts returning a new literal.",
          whyItMatters:
            "Strict SDKs and exhaustive client code often compile a closed enum set, so a newly returned value can become a source or runtime break.",
        };
      }

      if (profile === "internalApi" || profile === "tolerantClient") {
        return {
          severity: "safe",
          severityReason: `The ${formatConsumerProfileLabel(profile)} profile lowers this to safe because additive response enum values are usually tolerable for coordinated or tolerant consumers.`,
        };
      }

      return {
        severity: "dangerous",
        severityReason:
          profile === "mobileClient"
            ? "The mobile client profile keeps this at dangerous because older app releases often ship exhaustive enum handling and cannot update instantly."
            : `The ${formatConsumerProfileLabel(profile)} profile keeps this at dangerous because older deployed clients may reject or mishandle a new response enum value even though the wire contract only expanded.`,
      };
    }

    if (profile === "sdkStrict") {
      return {
        severity: "breaking",
        severityReason:
          "The SDK strict profile raises shared-schema enum additions to breaking because those components often feed generated client models on both request and response paths.",
      };
    }
  }

  if (
    schemaDirection === "response" &&
    (change.ruleId === "schema.property.added.optional" ||
      change.ruleId === "schema.required.added")
  ) {
    if (profile === "sdkStrict") {
      return {
        severity: "dangerous",
        severityReason:
          "The SDK strict profile raises additive response shape changes to dangerous because exact decoders and generated response models often assume a closed object shape.",
      };
    }

    if (profile === "tolerantClient") {
      return {
        severity: "info",
        severityReason:
          "The tolerant client profile lowers additive response fields to info because resilient readers usually ignore extra output members.",
      };
    }

    if (profile === "mobileClient" && change.ruleId === "schema.required.added") {
      return {
        severity: "dangerous",
        severityReason:
          "The mobile client profile raises required response field additions to dangerous because older released apps may decode exact payload shapes for longer than web clients.",
      };
    }

    return {
      severity: "safe",
      severityReason: `The ${formatConsumerProfileLabel(profile)} profile treats additive response fields as safe because the server is returning more data rather than removing supported behavior.`,
    };
  }

  if (schemaDirection === "response" && change.ruleId === "schema.required.removed") {
    if (profile === "sdkStrict" || profile === "mobileClient") {
      return {
        severity: "breaking",
        severityReason: `The ${formatConsumerProfileLabel(profile)} profile raises this to breaking because clients may be compiled against the old guarantee that this response field is always present.`,
      };
    }

    return {
      severity: "dangerous",
      severityReason: `The ${formatConsumerProfileLabel(profile)} profile treats this as dangerous because the response is no longer guaranteed to include a field older clients may expect.`,
    };
  }

  if (change.ruleId === "schema.nullable.changed" && profile === "mobileClient") {
    return {
      severity: elevateSeverity(baseSeverity, "breaking"),
      severityReason:
        "The mobile client profile raises nullability changes because older shipped apps often hard-code null handling and cannot pick up schema updates quickly.",
      whyItMatters:
        "Mobile clients frequently ship with closed model types and slower rollout cycles, so nullability changes can surface as crashes or silent parsing failures in older releases.",
    };
  }

  if (
    (schemaDirection === "response" || schemaDirection === "component") &&
    change.ruleId === "schema.oneOf.changed" &&
    profile === "sdkStrict"
  ) {
    return {
      severity: "breaking",
      severityReason:
        "The SDK strict profile raises changed oneOf variants to breaking because generated union types and discriminated decoders often assume a stable variant set.",
      whyItMatters:
        "Strict SDKs often compile `oneOf` unions into exact variant lists, so changing that list can break generated typing and runtime dispatch.",
    };
  }

  if (ADDITIVE_RESPONSE_RULE_IDS.has(change.ruleId)) {
    if (profile === "internalApi" || profile === "tolerantClient") {
      return {
        severity: "safe",
        severityReason: `The ${formatConsumerProfileLabel(profile)} profile lowers additive response contract changes to safe because they usually widen output rather than removing behavior.`,
      };
    }

    return {
      severity: baseSeverity,
      severityReason: `The ${formatConsumerProfileLabel(profile)} profile keeps this at ${baseSeverity} because strict consumers may still branch on a narrow response set.`,
    };
  }

  return {
    severity: baseSeverity,
    severityReason: `The ${formatConsumerProfileLabel(profile)} profile keeps this at ${baseSeverity} because ${lowercaseFirst(rule.whyItMatters)}`,
  };
}

function elevateSeverity(
  current: DiffSeverity,
  next: DiffSeverity,
): DiffSeverity {
  const severityRank: Record<DiffSeverity, number> = {
    breaking: 0,
    dangerous: 1,
    info: 3,
    safe: 2,
  };

  return severityRank[next] < severityRank[current] ? next : current;
}

function getSchemaDirection(change: DiffFinding): SchemaDiffDirection {
  return change.classificationContext?.schemaDirection ?? "unknown";
}

function lowerCaseFirstCharacter(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function lowercaseFirst(value: string) {
  return lowerCaseFirstCharacter(value.endsWith(".") ? value.slice(0, -1) : value);
}

function shouldIncludeFinding(finding: DiffFinding, settings: AnalysisSettings) {
  if (!settings.includeCategories.includes(finding.category)) {
    return false;
  }

  if (!settings.includeInfoFindings && finding.severity === "info") {
    return false;
  }

  if (matchesIgnoreRule(finding, settings.consumerProfile, settings.ignoreRules)) {
    return false;
  }

  return true;
}

function matchesIgnoreRule(
  finding: DiffFinding,
  consumerProfile: ConsumerProfile,
  ignoreRules: AnalysisSettings["ignoreRules"],
) {
  return ignoreRules.some((ignoreRule) => {
    if (ignoreRule.ruleId !== finding.ruleId) {
      return false;
    }

    if (
      ignoreRule.consumerProfiles &&
      !ignoreRule.consumerProfiles.includes(consumerProfile)
    ) {
      return false;
    }

    if (ignoreRule.operationId && ignoreRule.operationId !== finding.operationId) {
      return false;
    }

    if (
      ignoreRule.jsonPathPrefix &&
      !finding.jsonPointer.startsWith(ignoreRule.jsonPathPrefix)
    ) {
      return false;
    }

    return true;
  });
}

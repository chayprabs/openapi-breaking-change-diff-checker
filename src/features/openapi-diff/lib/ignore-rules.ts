import { ruleCatalog } from "@/features/openapi-diff/data/rule-catalog";
import type {
  ConsumerProfile,
  DiffFinding,
  IgnoreRule,
  MatchedIgnoreRule,
  OpenApiHttpMethod,
  RuleId,
} from "@/features/openapi-diff/types";

const MATCH_ALL_PATTERN = "*";

export function cloneIgnoreRule(rule: IgnoreRule): IgnoreRule {
  return {
    id: rule.id,
    ...(rule.label ? { label: rule.label } : {}),
    reason: rule.reason,
    source: rule.source,
    ...(rule.consumerProfiles ? { consumerProfiles: [...rule.consumerProfiles] } : {}),
    ...(rule.expiresAt ? { expiresAt: rule.expiresAt } : {}),
    ...(rule.findingId ? { findingId: rule.findingId } : {}),
    ...(rule.jsonPathPrefix ? { jsonPathPrefix: rule.jsonPathPrefix } : {}),
    ...(rule.method ? { method: rule.method } : {}),
    ...(rule.operationId ? { operationId: rule.operationId } : {}),
    ...(rule.pathPattern ? { pathPattern: rule.pathPattern } : {}),
    ...(rule.ruleId ? { ruleId: rule.ruleId } : {}),
    ...(rule.tag ? { tag: rule.tag } : {}),
  };
}

export function cloneIgnoreRules(rules: readonly IgnoreRule[]) {
  return rules.map((rule) => cloneIgnoreRule(rule));
}

export function createDeprecatedEndpointIgnoreRule(): IgnoreRule {
  return {
    id: "deprecatedEndpoint",
    label: "Deprecated endpoints",
    reason: "Exclude findings that belong to operations already marked deprecated.",
    source: "deprecatedEndpoint",
  };
}

export function createDocsOnlyIgnoreRule(): IgnoreRule {
  return {
    id: "docsOnly",
    label: "Docs-only changes",
    reason: "Reduce documentation-only noise while keeping those findings auditable.",
    source: "docsOnly",
  };
}

export function createFindingIgnoreRule(finding: DiffFinding): IgnoreRule {
  return {
    findingId: finding.id,
    id: `finding:${finding.id}`,
    label: `Finding: ${finding.title}`,
    reason: "Hide only this exact finding while keeping it available in the Ignored tab.",
    source: "finding",
  };
}

export function createMethodIgnoreRule(method: OpenApiHttpMethod): IgnoreRule {
  return {
    id: `method:${method}`,
    label: `Method ${method.toUpperCase()}`,
    method,
    reason: `Ignore findings attached to ${method.toUpperCase()} operations.`,
    source: "method",
  };
}

export function createOperationIdIgnoreRule(operationId: string): IgnoreRule {
  return {
    id: `operationId:${operationId}`,
    label: `operationId ${operationId}`,
    operationId,
    reason: `Ignore findings attached to operationId "${operationId}".`,
    source: "operationId",
  };
}

export function createPathPatternIgnoreRule(pathPattern: string): IgnoreRule {
  return {
    id: `pathPattern:${pathPattern}`,
    label: `Path ${pathPattern}`,
    pathPattern,
    reason: `Ignore findings whose path matches "${pathPattern}".`,
    source: "pathPattern",
  };
}

export function createRuleIdIgnoreRule(ruleId: RuleId): IgnoreRule {
  return {
    id: `ruleId:${ruleId}`,
    label: `Rule ${ruleId}`,
    reason: `Ignore findings produced by the "${ruleCatalog[ruleId].title}" rule.`,
    ruleId,
    source: "ruleId",
  };
}

export function createTagIgnoreRule(tag: string): IgnoreRule {
  return {
    id: `tag:${tag}`,
    label: `Tag ${tag}`,
    reason: `Ignore findings attached to operations carrying the "${tag}" tag.`,
    source: "tag",
    tag,
  };
}

export function getIgnoreRuleLabel(rule: IgnoreRule): string {
  if (rule.label) {
    return rule.label;
  }

  if (rule.source === "docsOnly") {
    return "Docs-only changes";
  }

  if (rule.source === "deprecatedEndpoint") {
    return "Deprecated endpoints";
  }

  if (rule.source === "finding" && rule.findingId) {
    return `Finding ${rule.findingId}`;
  }

  if (rule.source === "method" && rule.method) {
    return `Method ${rule.method.toUpperCase()}`;
  }

  if (rule.source === "operationId" && rule.operationId) {
    return `operationId ${rule.operationId}`;
  }

  if (rule.source === "pathPattern" && rule.pathPattern) {
    return `Path ${rule.pathPattern}`;
  }

  if (rule.source === "ruleId" && rule.ruleId) {
    return `Rule ${rule.ruleId}`;
  }

  if (rule.source === "tag" && rule.tag) {
    return `Tag ${rule.tag}`;
  }

  return rule.id;
}

export function getMatchingIgnoreRules(
  finding: DiffFinding,
  consumerProfile: ConsumerProfile,
  ignoreRules: readonly IgnoreRule[],
): MatchedIgnoreRule[] {
  return ignoreRules
    .filter((ignoreRule) => matchesIgnoreRule(ignoreRule, finding, consumerProfile))
    .map((ignoreRule) => ({
      id: ignoreRule.id,
      label: getIgnoreRuleLabel(ignoreRule),
      reason: ignoreRule.reason,
      source: ignoreRule.source,
    }));
}

export function matchesIgnoreRule(
  ignoreRule: IgnoreRule,
  finding: DiffFinding,
  consumerProfile: ConsumerProfile,
): boolean {
  if (
    ignoreRule.consumerProfiles &&
    !ignoreRule.consumerProfiles.includes(consumerProfile)
  ) {
    return false;
  }

  if (ignoreRule.findingId && ignoreRule.findingId !== finding.id) {
    return false;
  }

  if (ignoreRule.ruleId && ignoreRule.ruleId !== finding.ruleId) {
    return false;
  }

  if (ignoreRule.operationId && ignoreRule.operationId !== finding.operationId) {
    return false;
  }

  if (ignoreRule.method && ignoreRule.method !== finding.method) {
    return false;
  }

  if (ignoreRule.tag && !finding.tags?.includes(ignoreRule.tag)) {
    return false;
  }

  if (ignoreRule.pathPattern && !matchesPathPattern(ignoreRule.pathPattern, finding.path)) {
    return false;
  }

  if (
    ignoreRule.jsonPathPrefix &&
    !finding.jsonPointer.startsWith(ignoreRule.jsonPathPrefix)
  ) {
    return false;
  }

  if (ignoreRule.source === "docsOnly" && finding.category !== "docs") {
    return false;
  }

  if (ignoreRule.source === "deprecatedEndpoint" && !finding.operationDeprecated) {
    return false;
  }

  return true;
}

export function matchesPathPattern(pathPattern: string, path: string | null) {
  if (!path) {
    return false;
  }

  if (pathPattern === MATCH_ALL_PATTERN) {
    return true;
  }

  const expression = new RegExp(
    `^${escapeRegex(pathPattern).replaceAll("*", ".*")}$`,
  );

  return expression.test(path);
}

function escapeRegex(value: string) {
  return value.replaceAll(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

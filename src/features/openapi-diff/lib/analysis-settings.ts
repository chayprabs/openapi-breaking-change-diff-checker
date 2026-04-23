import type {
  AnalysisSettings,
  ConsumerProfile,
  DiffCategory,
  IgnoreRule,
  IgnoreRuleSource,
  RemoteRefPolicy,
} from "@/features/openapi-diff/types";
import { cloneIgnoreRules } from "@/features/openapi-diff/lib/ignore-rules";

const analysisCategories = [
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
] as const satisfies readonly DiffCategory[];

export const consumerProfileOptions = [
  {
    description: "Conservative default for externally consumed APIs and long-lived clients.",
    label: "Public API",
    value: "publicApi",
  },
  {
    description: "Still catches real breaks, but relaxes some strict-client rollout warnings.",
    label: "Internal API",
    value: "internalApi",
  },
  {
    description: "Treats generated SDKs and exact response models as the primary consumer.",
    label: "SDK strict",
    value: "sdkStrict",
  },
  {
    description: "Biases toward risks that are painful for slower-moving mobile app releases.",
    label: "Mobile client",
    value: "mobileClient",
  },
  {
    description: "Less strict for additive output changes, still strict for removals and narrowing.",
    label: "Tolerant client",
    value: "tolerantClient",
  },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: ConsumerProfile;
}>;

export const remoteRefPolicyOptions = [
  {
    description:
      "Default and safest mode. Only in-document JSON Pointer refs are resolved during analysis.",
    label: "Local refs only",
    value: "localOnly",
  },
  {
    description:
      "Allows public remote refs through the safe server proxy. Private, localhost, and metadata targets stay blocked.",
    label: "Allow public remote refs",
    value: "publicRemote",
  },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: RemoteRefPolicy;
}>;

export const defaultAnalysisSettings: AnalysisSettings = {
  customRedactionRules: [],
  consumerProfile: "publicApi",
  exportFormats: [],
  failOnSeverities: ["breaking"],
  ignoreRules: [],
  includeCategories: [...analysisCategories],
  includeInfoFindings: true,
  redactExamples: false,
  redactServerUrls: false,
  remoteRefPolicy: "localOnly",
  resolveLocalRefs: true,
  treatEnumAdditionsAsDangerous: false,
};

export function cloneAnalysisSettings(settings: AnalysisSettings): AnalysisSettings {
  return {
    customRedactionRules: settings.customRedactionRules.map((rule) => ({ ...rule })),
    consumerProfile: settings.consumerProfile,
    exportFormats: [...settings.exportFormats],
    failOnSeverities: [...settings.failOnSeverities],
    ignoreRules: cloneIgnoreRules(settings.ignoreRules),
    includeCategories: [...settings.includeCategories],
    includeInfoFindings: settings.includeInfoFindings,
    redactExamples: settings.redactExamples,
    redactServerUrls: settings.redactServerUrls,
    remoteRefPolicy: settings.remoteRefPolicy,
    resolveLocalRefs: settings.resolveLocalRefs,
    treatEnumAdditionsAsDangerous: settings.treatEnumAdditionsAsDangerous,
  };
}

export function createAnalysisSettings(
  overrides: Partial<AnalysisSettings> = {},
): AnalysisSettings {
  return {
    ...cloneAnalysisSettings(defaultAnalysisSettings),
    ...overrides,
    ...(overrides.exportFormats ? { exportFormats: [...overrides.exportFormats] } : {}),
    ...(overrides.failOnSeverities
      ? { failOnSeverities: [...overrides.failOnSeverities] }
      : {}),
    ...(overrides.customRedactionRules
      ? {
          customRedactionRules: overrides.customRedactionRules.map((rule) => ({ ...rule })),
        }
      : {}),
    ...(overrides.ignoreRules
      ? {
          ignoreRules: cloneIgnoreRules(overrides.ignoreRules),
        }
      : {}),
    ...(overrides.includeCategories ? { includeCategories: [...overrides.includeCategories] } : {}),
    ...(overrides.redactServerUrls !== undefined
      ? { redactServerUrls: overrides.redactServerUrls }
      : {}),
    ...(overrides.remoteRefPolicy !== undefined
      ? { remoteRefPolicy: overrides.remoteRefPolicy }
      : {}),
    ...(overrides.treatEnumAdditionsAsDangerous !== undefined
      ? {
          treatEnumAdditionsAsDangerous:
            overrides.treatEnumAdditionsAsDangerous,
        }
      : {}),
  };
}

export function addIgnoreRule(
  settings: AnalysisSettings,
  ignoreRule: IgnoreRule,
): AnalysisSettings {
  const nextSettings = cloneAnalysisSettings(settings);

  nextSettings.ignoreRules = [
    ...nextSettings.ignoreRules.filter((rule) => rule.id !== ignoreRule.id),
    { ...ignoreRule },
  ].sort((left, right) => left.id.localeCompare(right.id));

  return nextSettings;
}

export function removeIgnoreRule(
  settings: AnalysisSettings,
  ignoreRuleId: string,
): AnalysisSettings {
  const nextSettings = cloneAnalysisSettings(settings);
  nextSettings.ignoreRules = nextSettings.ignoreRules.filter((rule) => rule.id !== ignoreRuleId);
  return nextSettings;
}

export function hasIgnoreRuleSource(
  settings: AnalysisSettings,
  source: IgnoreRuleSource,
) {
  return settings.ignoreRules.some((rule) => rule.source === source);
}

export function serializeAnalysisSettings(settings: AnalysisSettings) {
  return JSON.stringify(cloneAnalysisSettings(settings), null, 2);
}

export function getConsumerProfileOption(profile: ConsumerProfile) {
  return consumerProfileOptions.find((option) => option.value === profile) ?? consumerProfileOptions[0];
}

export function formatConsumerProfileLabel(profile: ConsumerProfile) {
  return getConsumerProfileOption(profile).label;
}

export function formatRemoteRefPolicyLabel(policy: RemoteRefPolicy) {
  return (
    remoteRefPolicyOptions.find((option) => option.value === policy)?.label ??
    remoteRefPolicyOptions[0].label
  );
}

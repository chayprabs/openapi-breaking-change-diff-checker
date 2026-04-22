import type {
  AnalysisSettings,
  ConsumerProfile,
  DiffCategory,
} from "@/features/openapi-diff/types";

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

export const defaultAnalysisSettings: AnalysisSettings = {
  consumerProfile: "publicApi",
  exportFormats: [],
  failOnSeverities: ["breaking"],
  ignoreRules: [],
  includeCategories: [...analysisCategories],
  includeInfoFindings: true,
  redactExamples: false,
  resolveLocalRefs: true,
};

export function cloneAnalysisSettings(settings: AnalysisSettings): AnalysisSettings {
  return {
    consumerProfile: settings.consumerProfile,
    exportFormats: [...settings.exportFormats],
    failOnSeverities: [...settings.failOnSeverities],
    ignoreRules: settings.ignoreRules.map((rule) => ({
      ...rule,
      ...(rule.consumerProfiles ? { consumerProfiles: [...rule.consumerProfiles] } : {}),
    })),
    includeCategories: [...settings.includeCategories],
    includeInfoFindings: settings.includeInfoFindings,
    redactExamples: settings.redactExamples,
    resolveLocalRefs: settings.resolveLocalRefs,
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
    ...(overrides.ignoreRules
      ? {
          ignoreRules: overrides.ignoreRules.map((rule) => ({
            ...rule,
            ...(rule.consumerProfiles ? { consumerProfiles: [...rule.consumerProfiles] } : {}),
          })),
        }
      : {}),
    ...(overrides.includeCategories
      ? { includeCategories: [...overrides.includeCategories] }
      : {}),
  };
}

export function getConsumerProfileOption(profile: ConsumerProfile) {
  return consumerProfileOptions.find((option) => option.value === profile) ?? consumerProfileOptions[0];
}

export function formatConsumerProfileLabel(profile: ConsumerProfile) {
  return getConsumerProfileOption(profile).label;
}

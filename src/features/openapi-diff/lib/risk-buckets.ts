export const riskBuckets = {
  breaking: {
    label: "Breaking",
    description: "Incompatible changes that can fail existing clients or server integrations.",
  },
  dangerous: {
    label: "Dangerous",
    description:
      "Changes that may be technically additive but still carry runtime or rollout risk.",
  },
  safe: {
    label: "Safe",
    description:
      "Additive or compatibility-preserving changes that should not break existing clients.",
  },
  docsOnly: {
    label: "Docs-only",
    description: "Documentation or description updates that do not change contract behavior.",
  },
} as const;

export type RiskBucket = keyof typeof riskBuckets;

export const riskBucketOrder = [
  "breaking",
  "dangerous",
  "safe",
  "docsOnly",
] as const satisfies readonly RiskBucket[];

export type RiskBucketCounts = Partial<Record<RiskBucket, number>>;

export function buildRiskBucketSummary(counts: RiskBucketCounts) {
  return riskBucketOrder
    .map((bucket) => ({
      bucket,
      count: counts[bucket] ?? 0,
      ...riskBuckets[bucket],
    }))
    .filter((bucket) => bucket.count > 0);
}

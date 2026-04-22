import { describe, expect, it } from "vitest";
import { buildRiskBucketSummary, riskBucketOrder } from "@/features/openapi-diff/lib/risk-buckets";

describe("risk bucket helpers", () => {
  it("keeps report buckets in the intended order", () => {
    expect(riskBucketOrder).toEqual(["breaking", "dangerous", "safe", "docsOnly"]);
  });

  it("filters out empty buckets while preserving order", () => {
    const summary = buildRiskBucketSummary({
      docsOnly: 3,
      breaking: 1,
      safe: 4,
    }).map(({ bucket, count }) => [bucket, count]);

    expect(summary).toEqual([
      ["breaking", 1],
      ["safe", 4],
      ["docsOnly", 3],
    ]);
  });
});

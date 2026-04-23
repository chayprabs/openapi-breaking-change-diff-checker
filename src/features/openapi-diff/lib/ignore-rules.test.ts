import { describe, expect, it } from "vitest";
import {
  createDeprecatedEndpointIgnoreRule,
  createDocsOnlyIgnoreRule,
  createFindingIgnoreRule,
  createMethodIgnoreRule,
  createOperationIdIgnoreRule,
  createPathPatternIgnoreRule,
  createRuleIdIgnoreRule,
  createTagIgnoreRule,
  getMatchingIgnoreRules,
  matchesIgnoreRule,
  matchesPathPattern,
} from "@/features/openapi-diff/lib/ignore-rules";
import type {
  ConsumerProfile,
  DiffFinding,
} from "@/features/openapi-diff/types";

function createFinding(overrides: Partial<DiffFinding> = {}): DiffFinding {
  return {
    afterValue: null,
    baseSeverity: "dangerous",
    beforeValue: null,
    category: "parameter",
    evidence: {},
    id: "finding-1",
    jsonPointer: "#/paths/~1users/get/parameters/0",
    message: "A finding message.",
    method: "get",
    operationDeprecated: false,
    operationId: "listUsers",
    path: "/users",
    ruleId: "parameter.required.added",
    severity: "breaking",
    severityReason: "All profiles keep this at breaking.",
    tags: ["users"],
    title: "Required parameter added",
    whyItMatters: "Existing callers can fail.",
    ...overrides,
  };
}

describe("ignore rules", () => {
  it("matches docs-only and deprecated-endpoint rules only when the finding fits", () => {
    const docsFinding = createFinding({
      category: "docs",
      id: "docs-change",
      ruleId: "docs.description.changed",
    });
    const deprecatedFinding = createFinding({
      id: "deprecated-change",
      operationDeprecated: true,
    });

    expect(
      matchesIgnoreRule(createDocsOnlyIgnoreRule(), docsFinding, "publicApi"),
    ).toBe(true);
    expect(
      matchesIgnoreRule(createDocsOnlyIgnoreRule(), deprecatedFinding, "publicApi"),
    ).toBe(false);
    expect(
      matchesIgnoreRule(
        createDeprecatedEndpointIgnoreRule(),
        deprecatedFinding,
        "publicApi",
      ),
    ).toBe(true);
    expect(
      matchesIgnoreRule(createDeprecatedEndpointIgnoreRule(), docsFinding, "publicApi"),
    ).toBe(false);
  });

  it("matches finding, rule, method, operationId, path, and tag rules precisely", () => {
    const finding = createFinding();

    expect(
      matchesIgnoreRule(createFindingIgnoreRule(finding), finding, "publicApi"),
    ).toBe(true);
    expect(
      matchesIgnoreRule(
        createRuleIdIgnoreRule("parameter.required.added"),
        finding,
        "publicApi",
      ),
    ).toBe(true);
    expect(
      matchesIgnoreRule(createMethodIgnoreRule("get"), finding, "publicApi"),
    ).toBe(true);
    expect(
      matchesIgnoreRule(
        createOperationIdIgnoreRule("listUsers"),
        finding,
        "publicApi",
      ),
    ).toBe(true);
    expect(
      matchesIgnoreRule(createPathPatternIgnoreRule("/users"), finding, "publicApi"),
    ).toBe(true);
    expect(
      matchesIgnoreRule(createTagIgnoreRule("users"), finding, "publicApi"),
    ).toBe(true);

    expect(
      matchesIgnoreRule(createMethodIgnoreRule("post"), finding, "publicApi"),
    ).toBe(false);
    expect(
      matchesIgnoreRule(
        createOperationIdIgnoreRule("fetchUsers"),
        finding,
        "publicApi",
      ),
    ).toBe(false);
    expect(
      matchesIgnoreRule(
        createPathPatternIgnoreRule("/admin/*"),
        finding,
        "publicApi",
      ),
    ).toBe(false);
    expect(
      matchesIgnoreRule(createTagIgnoreRule("admin"), finding, "publicApi"),
    ).toBe(false);
  });

  it("honors consumer-profile scoping and returns matched rule metadata", () => {
    const finding = createFinding();
    const scopedRule = {
      ...createRuleIdIgnoreRule("parameter.required.added"),
      consumerProfiles: ["sdkStrict"] satisfies ConsumerProfile[],
    };
    const pathRule = createPathPatternIgnoreRule("/users");

    expect(matchesIgnoreRule(scopedRule, finding, "publicApi")).toBe(false);
    expect(matchesIgnoreRule(scopedRule, finding, "sdkStrict")).toBe(true);

    expect(
      getMatchingIgnoreRules(finding, "sdkStrict", [scopedRule, pathRule]),
    ).toEqual([
      {
        id: "ruleId:parameter.required.added",
        label: "Rule parameter.required.added",
        reason:
          'Ignore findings produced by the "Required parameter added" rule.',
        source: "ruleId",
      },
      {
        id: "pathPattern:/users",
        label: "Path /users",
        reason: 'Ignore findings whose path matches "/users".',
        source: "pathPattern",
      },
    ]);
  });

  it("supports wildcard path matching without overmatching null paths", () => {
    expect(matchesPathPattern("*", "/users")).toBe(true);
    expect(matchesPathPattern("/internal/*", "/internal/users")).toBe(true);
    expect(matchesPathPattern("/internal/*", "/external/users")).toBe(false);
    expect(matchesPathPattern("/users/*/tokens", "/users/123/tokens")).toBe(true);
    expect(matchesPathPattern("/users/*/tokens", null)).toBe(false);
  });
});

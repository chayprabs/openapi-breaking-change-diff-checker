import { describe, expect, it } from "vitest";
import { ruleCatalog, ruleCatalogList } from "@/features/openapi-diff/data/rule-catalog";
import { ruleIds } from "@/features/openapi-diff/types";

describe("rule catalog", () => {
  it("covers every declared rule id", () => {
    expect(Object.keys(ruleCatalog)).toEqual([...ruleIds]);
    expect(ruleCatalogList.map((rule) => rule.id)).toEqual([...ruleIds]);
  });

  it("provides complete metadata for every rule", () => {
    for (const rule of ruleCatalogList) {
      expect(rule.id).toBeTruthy();
      expect(rule.title.length).toBeGreaterThan(3);
      expect(rule.explanation.length).toBeGreaterThan(20);
      expect(rule.whyItMatters.length).toBeGreaterThan(20);
      expect(rule.saferAlternative.length).toBeGreaterThan(20);

      if (rule.example) {
        expect(rule.example.before.trim().length).toBeGreaterThan(0);
        expect(rule.example.after.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("assigns expected severities to representative rules", () => {
    expect(ruleCatalog["path.removed"].defaultSeverity).toBe("breaking");
    expect(ruleCatalog["security.scope.added"].defaultSeverity).toBe("dangerous");
    expect(ruleCatalog["docs.description.changed"].defaultSeverity).toBe("info");
    expect(ruleCatalog["schema.property.added.optional"].defaultSeverity).toBe("safe");
  });
});

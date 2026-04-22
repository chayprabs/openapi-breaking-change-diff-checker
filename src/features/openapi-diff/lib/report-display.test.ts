import { describe, expect, it } from "vitest";
import {
  createTooManyFindingsWarning,
  MAX_RENDERED_REPORT_FINDINGS,
} from "@/features/openapi-diff/lib/report-display";

describe("report display helpers", () => {
  it("does not warn when findings stay within the safe browser limit", () => {
    expect(createTooManyFindingsWarning(MAX_RENDERED_REPORT_FINDINGS)).toBeNull();
  });

  it("warns when the browser should trim the detailed findings list", () => {
    const warning = createTooManyFindingsWarning(MAX_RENDERED_REPORT_FINDINGS + 1);

    expect(warning).toContain(`${MAX_RENDERED_REPORT_FINDINGS + 1}`);
    expect(warning).toContain(`${MAX_RENDERED_REPORT_FINDINGS}`);
    expect(warning).toContain("CLI");
  });
});

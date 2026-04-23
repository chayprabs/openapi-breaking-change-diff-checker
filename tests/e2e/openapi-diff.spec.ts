import { expect, test, type Locator, type Page } from "@playwright/test";

const TOOL_PATH = "/tools/openapi-diff-breaking-changes";

test("loads the OpenAPI diff page", async ({ page }) => {
  await openTool(page);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "OpenAPI Diff Online: Find Breaking API Changes Before You Ship",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("sample-select")).toBeVisible();
  await expect(page.getByTestId("analyze-specs-button")).toBeVisible();
});

test("loads the breaking sample, runs analysis, and opens a finding detail", async ({
  page,
}) => {
  await openTool(page);
  await loadSample(page, "Breaking change sample");
  await runAnalysis(page);

  await expect
    .poll(() => readMetricValue(summaryPanel(page).getByTestId("severity-metric-breaking")))
    .toBeGreaterThan(0);

  await summaryPanel(page).getByRole("button", { name: "Open details" }).first().click();
  const findingDialog = page.getByRole("dialog");

  await expect(findingDialog).toBeVisible();
  await expect(findingDialog).toContainText("Affected contract surface");
  await expect(findingDialog.getByRole("button", { name: "Copy finding" })).toBeVisible();
});

test("copies the markdown report and applies an ignore rule", async ({ page }) => {
  await openTool(page);
  await loadSample(page, "Breaking change sample");
  await runAnalysis(page);

  await summaryPanel(page).getByRole("button", { name: "Open details" }).first().click();
  const findingDialog = page.getByRole("dialog");

  await findingDialog.getByRole("button", { name: "Ignore this finding" }).click();
  await findingDialog.getByRole("button", { name: "Close side panel" }).click();

  await expect(page.getByTestId("active-ignore-rules")).toBeVisible();
  await expect
    .poll(() => readMetricValue(summaryPanel(page).getByTestId("severity-metric-ignored")))
    .toBeGreaterThan(0);

  await page.getByRole("tab", { name: "Export" }).click();
  const confirmPromise = page.waitForEvent("dialog").then(async (confirmDialog) => {
    expect(confirmDialog.type()).toBe("confirm");
    expect(confirmDialog.message()).toContain("Secret-like values were detected in this export");
    await confirmDialog.accept();
  });

  await page.getByRole("button", { name: "Copy Markdown" }).click();
  await confirmPromise;
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("# OpenAPI Diff PR Report");
});

test("redacts and exports the privacy-sensitive sample", async ({ page }) => {
  await openTool(page);
  await loadSample(page, "Privacy-sensitive sample");
  await runAnalysis(page);

  await page.getByRole("tab", { name: "Export" }).click();
  await expect(page.getByText("Secret-like values detected in this export")).toBeVisible();

  await page.getByRole("button", { name: "Redact before export" }).click();
  await expect(page.getByTestId("redaction-preview")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^openapi-diff-report-.*\.json$/);
});

test.describe("mobile layout", () => {
  test.use({
    viewport: {
      height: 844,
      width: 390,
    },
  });

  test("shows the base, revision, and results tabs", async ({ page }) => {
    await openTool(page);

    await expect(page.getByRole("tab", { name: "Base" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Revision" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Results" })).toBeVisible();
  });
});

async function openTool(page: Page) {
  await page.goto(TOOL_PATH);
  await expect(page.getByTestId("sample-select")).toBeVisible({ timeout: 60_000 });
}

async function loadSample(page: Page, sampleLabel: string) {
  await page.getByTestId("sample-select").selectOption({ label: sampleLabel });
}

async function runAnalysis(page: Page) {
  await page.getByTestId("analyze-specs-button").click();
  await expect(summaryPanel(page).getByTestId("severity-metric-breaking")).toBeVisible();
  await expect(page.getByTestId("analyze-specs-button")).toHaveText("Analyze specs");
}

async function readMetricValue(metric: Locator) {
  const matches = (await metric.innerText()).match(/\b\d+\b/g);
  return Number(matches?.[0] ?? 0);
}

function summaryPanel(page: Page) {
  return page.getByRole("tabpanel", { name: "Summary" });
}

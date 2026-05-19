import { expect, test } from "@playwright/test";

test("runs GraphQL schema guard analysis", async ({ page }) => {
  await page.goto("/tools/graphql-schema-guard");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByText("User.name removed")).toBeVisible({ timeout: 15_000 });
});

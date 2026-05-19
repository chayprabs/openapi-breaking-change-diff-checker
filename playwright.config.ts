import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const HOST = "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  use: {
    acceptDownloads: true,
    baseURL,
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec next dev --hostname ${HOST} --port ${PORT}`,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? "playwright-dev-auth-secret",
      NEXT_PUBLIC_E2E_SLOW_ANALYSIS: "1",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});

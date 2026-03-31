import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: 1,
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/playwright-junit.xml" }],
    ["html", { outputFolder: "playwright-report", open: "never" }]
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "npm run start",
      cwd: "../backend",
      port: 4000,
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "npm run build && npm run preview -- --host 0.0.0.0 --port 5173 --strictPort",
      cwd: ".",
      port: 5173,
      reuseExistingServer: true,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});

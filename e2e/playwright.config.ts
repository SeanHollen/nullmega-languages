import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_FRONTEND_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

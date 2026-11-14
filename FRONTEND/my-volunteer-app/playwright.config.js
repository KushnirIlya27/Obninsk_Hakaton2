import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:5173",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 960 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: process.env.E2E_CHROMIUM_PATH
      ? {
          executablePath: process.env.E2E_CHROMIUM_PATH,
          args: JSON.parse(
            process.env.E2E_CHROMIUM_ARGS ||
              '["--no-sandbox","--disable-dev-shm-usage"]',
          ),
        }
      : {},
  },
});

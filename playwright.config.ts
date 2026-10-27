import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "npm run build && npm run start -- --port 3100",
    url: "http://localhost:3100",
    timeout: 120_000,
    env: { DATABASE_PATH: "data/playwright.db" },
  },
});

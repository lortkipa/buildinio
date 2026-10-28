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
  webServer: [
    {
      // Stands in for OpenAI (see tests/fake-openai.mjs).
      command: "node tests/fake-openai.mjs",
      port: 3101,
    },
    {
      command: "npm run build && npm run start -- --port 3100",
      url: "http://localhost:3100",
      timeout: 120_000,
      env: {
        DATABASE_PATH: "data/playwright.db",
        PROJECTS_PATH: "data/playwright-projects",
        OPENAI_API_KEY: "test",
        OPENAI_MODEL: "fake",
        OPENAI_BASE_URL: "http://localhost:3101/v1",
        SANDBOX: "host", // The fake's apps build with plain Node: no Docker needed.
      },
    },
  ],
});

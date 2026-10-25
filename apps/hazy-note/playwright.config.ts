import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Playwright runs as a bare script — load the app's own .env.local so the
// Clerk keys (+ OPENROUTER_API_KEY for the chat spec) are available.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;
// `/` 404s (the app entry is /notes); probe a public route that returns 200.
const healthURL = `${baseURL}/sign-in`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "signed-out",
      testMatch: /\.signed-out\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: /\.signed-out\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.clerk/user.json",
      },
    },
  ],
  // Reuse the dev server if one is already up (that's the common local case);
  // otherwise start it.
  webServer: {
    command: "bun run --filter hazy-note dev",
    url: healthURL,
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: "../..",
  },
});

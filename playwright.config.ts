import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the personal cabinet in demo mode (no backend needed).
//   npm run test:e2e            builds with NEXT_PUBLIC_API_MOCK=1 and starts on :3100
//   E2E_BASE_URL=http://...     test an already running server instead
//   E2E_SCREENSHOTS=<dir>       also save review screenshots there
// Browsers: Playwright's Chromium (CI: `npx playwright install --with-deps chromium`).
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        // Full Chromium in new headless mode: the headless shell reports
        // Notification.permission "denied" even when granted.
        channel: "chromium",
        locale: "ru-RU",
        timezoneId: "Europe/Moscow",
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${PORT}`,
        url: `${BASE}/app.webmanifest`,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        env: { NEXT_PUBLIC_API_MOCK: "1" },
      },
});

// End-to-end tests (ADR 0003): Chromium only, a phone and a laptop. Vite runs with VITE_E2E=1, which swaps
// Auth0 for a fake signed-in citizen; e2e/fixtures.js answers every API, Cloudinary and map tile request.
import { defineConfig } from "@playwright/test";

const PORT = 5199; // not 5173, so a running `npm run dev` (real Auth0) is never reused by mistake
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0, // a flaky test should fail loudly, not pass on its second try
  workers: CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    // A device outside India: dates on screen must still be IST.
    timezoneId: "Europe/London",
    locale: "en-IN",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 60_000,
    // Empty VITE_API_URL: API calls stay same-origin, so every one is a route the fixtures fulfil.
    env: { VITE_E2E: "1", VITE_API_URL: "" },
  },
});

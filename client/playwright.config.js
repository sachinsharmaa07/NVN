// End-to-end tests (ADR 0003): Chromium only, a phone and a laptop, against the production bundle served by
// `vite preview`. It is built with --mode e2e and VITE_E2E=1, which swaps Auth0 for a fake signed-in citizen
// (a normal build refuses the flag); e2e/fixtures.js answers every API, Cloudinary and map tile request.
import { defineConfig } from "@playwright/test";

const PORT = 5199; // not 5173, so a running `npm run dev` (real Auth0) is never reused by mistake
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  // One retry in CI, so a flake is reported as "flaky" (with its trace) instead of failing the run or hiding.
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    // A device outside India: dates on screen must still be IST.
    timezoneId: "Europe/London",
    locale: "en-IN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx vite build --mode e2e && npx vite preview --mode e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Locally a preview already on 5199 is reused: rebuild (stop it) after changing the app.
    reuseExistingServer: !CI,
    timeout: 120_000, // includes the build
    // Empty VITE_API_URL: API calls stay same-origin, so every one is a route the fixtures fulfil.
    env: { VITE_E2E: "1", VITE_API_URL: "" },
  },
});

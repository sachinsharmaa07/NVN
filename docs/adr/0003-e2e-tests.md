# ADR 0003: End-to-end tests with Playwright, a test-only auth adapter and mocked network

**Status:** Accepted, 26 Nov 2026

## Context
The M1 report flow (pincode, map pin, photos, submit, counterfoil) crosses Auth0, our API, Cloudinary and
OpenStreetMap tiles. Unit tests cover each piece with jsdom, but jsdom can't run Leaflet, canvas resizing or real
focus order. We need browser tests that run in CI on every pull request without Auth0 credentials, a database,
Cloudinary keys or the internet, and that never put a fake sign-in into a real deploy.

## Decision
- **Runner:** `@playwright/test`, Chromium only, two projects: mobile (360×740, touch) and desktop (1280×800).
  Config `client/playwright.config.js`, tests in `client/e2e/`. `webServer` runs `vite build --mode e2e`
  then `vite preview` on port 5199, with `VITE_E2E=1` and `VITE_API_URL=""` (same origin, so every API call is a
  plain route to fulfil). Tests hit the minified production bundle, not the dev server. Traces and screenshots
  are kept on failure; CI retries once so a flake is reported as "flaky" (retries 0 locally).
- **Auth:** `VITE_E2E=1` makes `AuthProvider` render `E2EAuthProvider` instead of Auth0. It sends a fixed
  fake token and loads the user from `GET /api/me`, as production does. Pages, `useApi`, `RequireAuth` and
  `useAuth()` are unchanged; only `AuthProvider` swaps the adapter.
- **Never shipped:** `vite.config.js` calls `assertNoE2EBuild` (`src/lib/buildGuard.js`, unit-tested): a
  build with `VITE_E2E` set fails unless it is `--mode e2e`, which writes to `dist-e2e/` (git-ignored, never
  deployed) instead of `dist/`. The branch is a literal `import.meta.env.VITE_E2E === "1"`, so a normal
  build drops the adapter (checked: the fake token is not in `dist/`).
- **Network:** `e2e/fixtures.js` answers `/api/me`, `/api/pincodes/:pin`, `check-point`, `/api/uploads/sign`, the
  Cloudinary upload URL and `/api/issues` with the shapes in `docs/API.md`. OSM tiles get a 1×1 PNG. Any other
  request off `localhost` is aborted and fails the test, so no test can reach the internet by accident.
- **CI:** a separate `e2e` job after `check` installs Chromium with its system deps, runs the suite and uploads
  `playwright-report/` when it fails. The `check` job is unchanged.

## Consequences
- E2E tests prove the client against the documented API, not the real server; the server's own behaviour is
  covered by the Supertest suite on a real MongoDB. A change to an API shape must update `docs/API.md`, the server
  tests and `e2e/fixtures.js` together.
- Auth0 itself (redirects, PKCE, MFA) is not exercised; that stays a manual check before a release.
- Anyone can run the suite offline after `npx playwright install chromium`.

## Rejected
- **A real test tenant in Auth0:** needs secrets in CI, is slow, and makes forks unable to run e2e.
- **A token-injecting backdoor in the server:** a bug there would be an auth bypass in production.
- **Mock Service Worker:** another dependency; Playwright's `page.route` already does this.

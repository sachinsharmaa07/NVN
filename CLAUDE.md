# Nivaran v2

Civic issue reporting for Indian cities. A citizen enters a 6-digit pincode, drops a pin inside that
pincode's boundary, adds a photo and details, and gets a ticket ID (`NIV-YYYY-NNNNNN`). Staff work an
SLA-driven queue. There is an AI help chatbot (Gemini) and a moderated community feed.

- Product and data design: `docs/DESIGN.md` (where it disagrees with this file, this file wins)
- All visual and copy rules: `docs/UI.md`. **Follow docs/UI.md for all UI.** No colours or fonts here.
- Decisions: `docs/adr/` (0001 stack and dependencies, 0002 layering)

**Stack:** Node 22, Express 5 (ESM), Zod 4, Mongoose on MongoDB Atlas | React + Vite (JavaScript, no
TypeScript), React Router, TanStack Query, Tailwind CSS v4, shadcn/ui, Leaflet | Auth0 (Phase 1).
npm workspaces at the root (`client`, `server`); one `package-lock.json`. Server port 5000, client 5173.

## Folder tree (two apps in npm workspaces)

```text
package.json  npm workspaces + root scripts; eslint.config.js, .prettierrc, README.md
client/
  src/        components/ (ui/ = shadcn, theme/, layout/, map/, chat/), pages/, hooks/, lib/, i18n/,
              styles/globals.css (UI.md tokens), App.jsx, main.jsx
  e2e/        Playwright tests
server/
  src/        config/ (env.js, db.js, logger.js), middleware/, routes/, controllers/, services/,
              models/, validators/, utils/, jobs/, app.js, server.js
  scripts/    one-off data scripts (importPincodes.js)
  tests/      unit/ (Vitest) and api/ (Vitest + Supertest)
docs/         DESIGN.md, UI.md, AUTH0_SETUP.md, adr/
```
`.github/workflows/ci.yml` (lint + test) is added in Phase 0. No new top-level folders without asking.

## Server rules
- **Layers:** route -> controller -> service -> model. Controllers never touch Mongoose. See ADR 0002.
- **Validate everything:** a Zod `.strict()` schema on `body`, `params` and `query` of every route.
- **Trust nothing from the client:** `role`, `cityId` and `departmentId` come only from `req.user`,
  never from the body. Every `:id` route checks ownership or scope.
- **Auth chain** (`middleware/auth.js`, `access.js`): `authenticate` (Auth0 RS256 token) -> `loadUser` (reads
  MongoDB each request; roles live there, not in the token) -> `requireVerifiedEmail` -> `requirePermission` ->
  `requireScope`. Rules are pure functions in `utils/access.js`. Setup: `docs/AUTH0_SETUP.md`.
- **Lists:** cursor-paginated (`createdAt` + `_id`), page size max 50. Every query is backed by an
  index declared in its model file. Use `.lean()` and projections for reads.
- **Errors:** always `{ "error": { "code": "OUTSIDE_PINCODE", "message": "..." } }`. Codes are
  UPPER_SNAKE. Throw `AppError(code, status, message)`; one `errorHandler` formats it.
- **Logs:** pino + pino-http, JSON, with the request id (`X-Request-Id`) on every line. Never send stack traces to the client.
- **Secrets:** only in `.env` (never committed), loaded with dotenv. Env is checked with Zod at start-up (`config/env.js`).
- **Time:** store UTC; show IST (`Asia/Kolkata`); dates like `26 Nov 2026`.
- **Enums (fixed):** issue status `submitted | assigned | in_progress | resolved | closed | reopened |
  rejected`. SLA state `on_track | at_risk (>= 75% used) | breached`; "on hold" is the flag
  `slaPausedAt`, not a status. Roles `citizen | moderator | staff | dept_head | city_admin |
  state_officer | super_admin`.
- **Middleware order:** requestId, pino-http, helmet, cors (allow-list `CLIENT_URL`), express.json (100kb), global
  rate limit, routes, notFound, errorHandler. Express 5 forwards async errors, so no `asyncHandler` wrapper.
- **One server instance for now** (in-memory rate limit, in-process SLA timer). See ADR 0001.

## Tests
- Vitest unit tests for pure logic in `server/src/utils/` (ticket IDs, state machine, haversine, india.js).
- Supertest API tests in `server/tests/api/` against `MONGODB_URI_TEST` only (tests may wipe it).
- Playwright e2e in `client/e2e/` (installed when the report wizard exists).
- Every bug fix comes with a test that failed before the fix.
- Done = tests pass and lint is clean in both apps.

## Naming
| Thing | Convention | Example |
|---|---|---|
| JS files | camelCase.js | `issueService.js`, `ticketId.js` |
| React components | PascalCase.jsx | `ReportWizard.jsx` |
| shadcn components | as generated, in `client/src/components/ui/` | `button.jsx` |
| Mongoose models | singular PascalCase | `Issue`, `SlaPolicy` |
| API routes | `/api/` + kebab-case plural | `/api/issues`, `/api/sla-policies` |
| Error codes | UPPER_SNAKE | `EMAIL_NOT_VERIFIED` |
| Env vars | UPPER_SNAKE | `MONGODB_URI_TEST` |
| i18n keys | `area.screen.key` | `report.wizard.title` |

## Dependencies (canonical list and reasons: ADR 0001)
- server: express, mongoose, zod, pino, pino-http, helmet, cors, express-rate-limit, dotenv
- client: react, react-dom, react-router, @tanstack/react-query, tailwindcss, shadcn/ui deps
  (radix-ui, lucide-react, sonner, vaul, class-variance-authority, clsx, tailwind-merge, tw-animate-css),
  react-hook-form + @hookform/resolvers (shadcn Form), leaflet (Phase 3), @fontsource packages,
  motion (shared variants in `client/src/lib/motion.js`), @number-flow/react (dashboard tiles + Landing stats)
- dev (root): eslint 9 + @eslint/js, globals, eslint-plugin-react, -react-hooks, -react-refresh, -jsx-a11y, -n,
  eslint-config-prettier, prettier, concurrently
- dev (apps): vite, @vitejs/plugin-react, tailwindcss + @tailwindcss/vite, vitest, supertest, jsdom,
  @testing-library/react, @testing-library/dom, @testing-library/jest-dom
- added with their phase: @base-ui-components/react (only for a primitive Radix
  lacks), Magic UI copy-paste accents (Home only; scopes in docs/UI.md §6.1), @google/genai (chatbot),
  express-oauth2-jwt-bearer + @auth0/auth0-react (auth), @playwright/test (report wizard), marked + sanitize-html together (only if posts get Markdown)
- built in-house, no package: request-id middleware (pino-http does the logging), Cloudinary upload signing (`node:crypto`),
  SLA timer (`setInterval`), point-in-polygon (`utils/geo.js`, unit-tested), i18n `t()` helper
  (`client/src/i18n/en.json`)

## Scripts (run from the repo root)
```text
npm run dev            server + client together (concurrently)
npm run check          lint + all tests (what CI runs, plus format:check and build)
npm test | npm run lint | npm run build | npm run format | npm run test:e2e (from Phase 3)
npm run dev -w server  one app only (-w client for the client)
```

## Skills to use
| Task | Skill / agent |
|---|---|
| Any backend feature | `backend-design:think-before-coding` |
| Schema and indexes | `backend-design:data-modeling-discipline` + `query-discipline`, then `schema-reviewer` agent |
| Auth, roles, city scope | `backend-design:auth-and-authorization` |
| Security | `backend-design:security-discipline` + `security-reviewer` agent |
| Errors and logs | `backend-design:error-handling-as-design` + `observability-by-default` |
| UI | `frontend-design:frontend-design`, then `design:design-critique` and `design:accessibility-review` |
| Tests | `backend-design:testing-with-discernment` + `engineering:testing-strategy` |
| Review before merge | `engineering:code-review` |
| Bugs | `engineering:debug` |

## Working rules
- Use plan mode before any change that touches more than one file.
- Never commit, push, deploy or delete files without asking Sachin first.
- Ask before adding any package not in the Dependencies list above.
- Explain non-obvious code line by line.
- Keep files under ~200 lines; split by responsibility when they grow.

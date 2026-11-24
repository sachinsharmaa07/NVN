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
  scripts/    one-off scripts (bootstrapSuperAdmin.js, syncMfaFlags.js, migrateUsersV1.js)
  tests/      unit/ (Vitest) and api/ (Vitest + Supertest)
docs/         DESIGN.md, UI.md, AUTH0_SETUP.md, adr/
```
`.github/workflows/ci.yml` (lint + test) is added in Phase 0. No new top-level folders without asking.

## Server rules
- **Layers:** route -> controller -> service -> model. Controllers never touch Mongoose. See ADR 0002.
- **Validate everything:** a Zod `.strict()` schema on `body`, `params` and `query` of every route.
- **Trust nothing from the client:** `role`, `cityId` and `departmentId` come only from `req.user`,
  never from the body. Every `:id` route checks ownership or scope. One carve-out: the admin role-change body may
  carry the target's `cityId`, `departmentId` and `stateCode`; the service validates them against the actor's scope.
- **Auth chain** (`middleware/auth.js`, `middleware/access.js`): `authenticate` (Auth0 RS256 token) -> `loadUser`
  (reads MongoDB on every request) -> `requireActive` -> `requireVerifiedEmail` -> `requirePermission(perm)` ->
  service scope check (`requireScope` no longer exists; the service applies the scope inside the DB query).
  Rules are pure functions in `utils/permissions.js` (matrix, scope rules, `can`); scope and level checks live in the services. Setup: `docs/AUTH0_SETUP.md`.
- **Auth rules:**
  - The database is the source of truth for `role`, scope (`cityId`, `departmentId`, `stateCode`) and `status`.
    Never read them from the token or the request body.
  - Out of scope or missing `:id` is **404**, with an identical body, never 403.
  - Nobody grants, changes or suspends a level >= their own, and nobody changes themselves.
  - Every role or status change writes an AuditLog row in the **same transaction** as the user update.
  - Admin writes follow the Auth0 order in `docs/phase-1-auth.md` section 7.2 (MFA flag first when raising to
    level >= 4; flag cleared after the transaction when lowering).
  - Tokens live in memory only, never in localStorage or sessionStorage.
  - No own passwords, JWT signing or OTP: Auth0 does all of it.
  - The Auth0 Management client (`services/auth0ManagementClient.js`) is mocked only in tests, never in app code.
    M2M secrets stay server-side and are never logged.
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
- Supertest API tests in `server/tests/api/` need a MongoDB replica set: `MONGODB_URI_TEST` (name ends `_test`; tests wipe it)
  or, when unset, an in-memory replica set from mongodb-memory-server (downloads mongod from fastdl.mongodb.org).
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
  (radix-ui, lucide-react, sonner, class-variance-authority, clsx, tailwind-merge, tw-animate-css),
  react-hook-form + @hookform/resolvers (shadcn Form), leaflet (Phase 3), @fontsource packages,
  motion (shared variants in `client/src/lib/motion.js`), @number-flow/react (dashboard tiles + Landing stats)
- dev (root): eslint 9 + @eslint/js, globals, eslint-plugin-react, -react-hooks, -react-refresh, -jsx-a11y, -n,
  eslint-config-prettier, prettier, concurrently
- dev (apps): vite, @vitejs/plugin-react, tailwindcss + @tailwindcss/vite, vitest, supertest, jsdom,
  @testing-library/react, @testing-library/dom, @testing-library/jest-dom
- Drawer: built on Radix Dialog (`components/ui/drawer.jsx`); `vaul` is NOT installed. Swapping to vaul needs approval.
- added with their phase: @base-ui-components/react (only for a primitive Radix
  lacks), Magic UI copy-paste accents (Home only; scopes in docs/UI.md §6.1), @google/genai (chatbot),
  express-oauth2-jwt-bearer + @auth0/auth0-react (auth; both now installed), @playwright/test (report wizard), marked + sanitize-html together (only if posts get Markdown)
- built in-house, no package: request-id middleware (pino-http does the logging), Cloudinary upload signing (`node:crypto`),
  SLA timer (`setInterval`), point-in-polygon (`utils/geo.js`, unit-tested), i18n `t()` helper
  (`client/src/i18n/en.json`)

## Scripts (run from the repo root)
```text
npm run dev            server + client together (concurrently)
npm run check          lint + all tests (what CI runs, plus format:check and build)
npm test | npm run lint | npm run build | npm run format | npm run test:e2e (from Phase 3)
npm run bootstrap:super-admin -w server | sync:mfa-flags | migrate:users-v1   (see README)
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

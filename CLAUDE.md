# Nivaran v2

Civic issue reporting for Indian cities. A citizen enters a 6-digit pincode, drops a pin inside that
pincode's boundary, adds a photo and details, and gets a ticket ID (`NIV-YYYY-NNNNNN`). Staff work an
SLA-driven queue. There is an AI help chatbot (Gemini) and a moderated community feed.

- Product and data design: `docs/DESIGN.md` (where it disagrees with this file, this file wins)
- All visual and copy rules: `docs/UI.md`. **Follow docs/UI.md for all UI.** No colours or fonts here.
- Decisions: `docs/adr/` (0001 stack and dependencies, 0002 layering)

**Stack:** Node 22, Express 5 (ESM), Zod 4, Mongoose on MongoDB Atlas | React + Vite (JavaScript, no
TypeScript), React Router, TanStack Query, Tailwind CSS v4, shadcn/ui, Leaflet | Auth0 later.

## Folder tree (two apps, no root package.json)

```text
client/
  src/        components/ (ui/ = shadcn, layout/, map/, chat/), pages/, hooks/, lib/, i18n/, App.jsx, main.jsx
  e2e/        Playwright tests
server/
  src/        config/ (env.js, db.js, logger.js), middleware/, routes/, controllers/, services/,
              models/, utils/, jobs/, app.js, server.js
  scripts/    one-off data scripts (importPincodes.js)
  tests/      unit/ (Vitest) and api/ (Vitest + Supertest)
docs/         DESIGN.md, UI.md, adr/
```
`.github/workflows/ci.yml` (lint + test) is added in Phase 0. No new top-level folders without asking.

## Server rules
- **Layers:** route -> controller -> service -> model. Controllers never touch Mongoose. See ADR 0002.
- **Validate everything:** a Zod `.strict()` schema on `body`, `params` and `query` of every route.
- **Trust nothing from the client:** `role`, `cityId` and `departmentId` come only from `req.user`,
  never from the body. Every `:id` route checks ownership or scope.
- **Lists:** cursor-paginated (`createdAt` + `_id`), page size max 50. Every query is backed by an
  index declared in its model file. Use `.lean()` and projections for reads.
- **Errors:** always `{ "error": { "code": "OUTSIDE_PINCODE", "message": "..." } }`. Codes are
  UPPER_SNAKE. Throw `AppError(code, status, message)`; one `errorHandler` formats it.
- **Logs:** pino JSON with a request id on every line. Never send stack traces to the client.
- **Secrets:** only in `.env` (never committed). Env is checked with Zod at start-up (`config/env.js`).
- **Time:** store UTC; show IST (`Asia/Kolkata`); dates like `26 Nov 2026`.
- **Enums (fixed):** issue status `submitted | assigned | in_progress | resolved | closed | reopened |
  rejected`. SLA state `on_track | at_risk (>= 75% used) | breached`; "on hold" is the flag
  `slaPausedAt`, not a status. Roles `citizen | moderator | staff | dept_head | city_admin |
  state_officer | super_admin`.
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
- server: express, mongoose, zod, pino, helmet, express-rate-limit
- client: react, react-dom, react-router, @tanstack/react-query, tailwindcss, shadcn/ui deps
  (radix-ui, lucide-react, sonner, vaul, class-variance-authority, clsx, tailwind-merge, tw-animate-css),
  react-hook-form + @hookform/resolvers (shadcn Form), leaflet, @fontsource packages
- dev: vite, vitest, supertest, eslint
- added with their phase: @number-flow/react (dashboards), @base-ui-components/react (only for a primitive Radix
  lacks), Magic UI copy-paste accents (Home only; scopes in docs/UI.md §6.1), @google/genai (chatbot),
  express-oauth2-jwt-bearer + @auth0/auth0-react (auth), @playwright/test (report wizard), marked + sanitize-html together (only if posts get Markdown)
- built in-house, no package: request-id logging middleware, Cloudinary upload signing (`node:crypto`),
  SLA timer (`setInterval`), point-in-polygon (`utils/geo.js`, unit-tested), i18n `t()` helper
  (`client/src/i18n/en.json`)

## Scripts (filled in at Phase 0)
```text
server: npm run dev | npm test | npm run lint
client: npm run dev | npm test | npm run lint | npx playwright test
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

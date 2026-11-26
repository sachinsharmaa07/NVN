# Nivaran v2: conventions

Moved out of `CLAUDE.md` on 25 Nov 2026 so that file stays short. Same rules, same wording. `CLAUDE.md` wins on conflict.

## Layout
- `client/src/`: components/ (ui/ = shadcn, theme/, layout/, map/, chat/), pages/, hooks/, lib/, i18n/,
  styles/globals.css (UI.md tokens), App.jsx, main.jsx. `client/e2e/`: Playwright.
- `server/src/`: config/ (env, db, logger), middleware/, routes/, controllers/, services/, models/, validators/,
  utils/, jobs/, app.js, server.js. `server/scripts/`: one-off scripts. `server/tests/`: unit/ and api/.
- `docs/`, `.github/workflows/ci.yml`. No new top-level folders without asking.

## Server rules
- **Validate everything:** a Zod `.strict()` schema on `body`, `params` and `query` of every route.
- **Trust nothing from the client:** `role`, `cityId`, `departmentId` come only from `req.user`. Every `:id` route
  checks ownership or scope. Carve-out: the admin role-change body may carry the target's `cityId`, `departmentId`,
  `stateCode`; the service validates them against the actor's scope.
- **Lists:** cursor-paginated (`createdAt` + `_id`), page size max 50, every query backed by an index declared in
  its model file, `.lean()` and projections for reads.
- **Logs:** pino + pino-http JSON, request id (`X-Request-Id`) on every line. **Time:** store UTC, show IST, `26 Nov 2026`.
- **Secrets:** only in `.env` (never committed), dotenv, checked with Zod at start-up (`config/env.js`).
- **Enums:** issue status `submitted | assigned | in_progress | resolved | closed | reopened | rejected`. SLA state
  `on_track | at_risk (>= 75% used) | breached`; "on hold" is the flag `slaPausedAt`. Roles `citizen | moderator |
  staff | dept_head | city_admin | state_officer | super_admin`.
- **Middleware order:** requestId, pino-http, helmet, cors (allow-list `CLIENT_URL`), express.json (100kb), global
  rate limit, routes, notFound, errorHandler. Express 5 forwards async errors (no `asyncHandler`).
- **One server instance** for now (in-memory rate limit, in-process SLA timer). ADR 0001.

## Tests
- Vitest unit tests for pure logic in `server/src/utils/`; Supertest API tests in `server/tests/api/` on a replica
  set: `MONGODB_URI_TEST` (name ends `_test`, wiped) or in-memory mongodb-memory-server. Playwright in `client/e2e/`.
- **Naming:** files `camelCase.js`, components `PascalCase.jsx`, models singular (`SlaPolicy`), routes `/api/` +
  kebab-case plural, error codes and env vars UPPER_SNAKE, i18n keys `area.screen.key`.

## Dependencies (reasons: ADR 0001). Ask before adding anything not listed.
- server: express, mongoose, zod, pino, pino-http, helmet, cors, express-rate-limit, dotenv, express-oauth2-jwt-bearer
- client: react, react-dom, react-router, @tanstack/react-query, tailwindcss, shadcn deps (radix-ui, lucide-react,
  sonner, class-variance-authority, clsx, tailwind-merge, tw-animate-css), react-hook-form + @hookform/resolvers,
  @auth0/auth0-react, @fontsource/*, motion (variants in `lib/motion.js`), @number-flow/react, leaflet (Phase 3)
- dev: eslint 9 + plugins, prettier, concurrently, vite, vitest, supertest, jsdom, @testing-library/*
- Later, with their phase: @google/genai, @playwright/test, @base-ui-components/react (only where Radix lacks),
  Magic UI accents (Home only, UI.md §6.1), marked + sanitize-html together. Drawer is Radix Dialog; no `vaul`.
- In-house, no package: request-id, Cloudinary signing (`node:crypto`), SLA timer, point-in-polygon
  (`utils/geo.js`), i18n `t()`.

## Skills
backend `think-before-coding`; schema `data-modeling-discipline` + `query-discipline` + `schema-reviewer`;
auth `auth-and-authorization`; security `security-discipline` + `security-reviewer`; errors/logs
`error-handling-as-design` + `observability-by-default`; UI `frontend-design` then `design-critique` +
`accessibility-review`; tests `testing-with-discernment`; review `engineering:code-review`; bugs `engineering:debug`.

## graphify
Knowledge graph in `graphify-out/` (skill: `/graphify`). Before the first grep or source read for a codebase question, run
`graphify query "<question>"` (also `path "<A>" "<B>"`, `explain "<concept>"`, `section "<heading>"`); put this rule in
every subagent prompt that explores code. Read raw files only for lines the graph located. Use
`graphify-out/wiki/index.md` for navigation if present; `GRAPH_REPORT.md` only for broad review. After code
changes run `graphify update .`.

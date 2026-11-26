# Nivaran v2

Civic issue reporting for Indian cities. A citizen enters a 6-digit pincode, drops a pin inside that
pincode's boundary, adds a photo and details, and gets a ticket ID (`NIV-YYYY-NNNNNN`). Staff work an
SLA-driven queue. There is an AI help chatbot (Gemini) and a moderated community feed.

**Stack:** Node 22, Express 5 (ESM), Zod 4, Mongoose on MongoDB Atlas | React + Vite (JavaScript, no TypeScript),
React Router, TanStack Query, Tailwind CSS v4, shadcn/ui, Leaflet | Auth0. npm workspaces (`client`, `server`),
one `package-lock.json`. **Ports:** server 5001 (macOS AirPlay holds 5000), client 5173.

## Where things live
- Plan: `docs/PLAN.md`. Decisions: `docs/DECISIONS.md` (change a row there first, then the code). Handoff: `docs/HANDOFF.md`.
- Layout, server details, enums, tests, dependency list, graphify: **`docs/CONVENTIONS.md`**.
- Skills (use only these): frontend-design:frontend-design (UI), backend-design:think-before-coding (server code),
  engineering:system-design (HLD: components, data flow, APIs), engineering:architecture (LLD decisions and ADRs).
  Do not load other skills or agents unless I ask.
- `docs/DESIGN.md` (this file wins on conflict), `docs/adr/` (0001 stack, 0002 layering), `docs/phase-1-auth.md`,
  `docs/AUTH0_SETUP.md`. **Follow `docs/UI.md` for all UI**; no colours or fonts here.
- `docs/ARCHITECTURE.md` is 97 KB. Never read it whole: run `grep -n '^## '` on it and read only the section you need.
- Prompts: `docs/prompts/` (one file per milestone). Run one step at a time with `/step <file> <n>`,
  e.g. `/step m1-core-loop.md 1`; `/clear` between steps.
- Codebase questions: run `graphify query "<question>"` before the first grep or source read; `graphify update .`
  after code changes.

## Commands (repo root)
`npm run dev` (both apps; `-w server` / `-w client` for one) | `npm run check` (lint, tests, format:check, build;
what CI runs) | `npm test`, `lint`, `build`, `format`, `test:e2e` | `-w server`: `bootstrap:super-admin`,
`sync:mfa-flags`, `migrate:users-v1` (see README).

## Server rules
- **Layers:** route -> controller -> service -> model. Controllers never touch Mongoose (ADR 0002).
- **Errors:** `{ "error": { "code": "UPPER_SNAKE", "message": "..." } }`. Throw `AppError(code, status, message)`;
  one `errorHandler` formats it. Never send stack traces to the client.
- Zod `.strict()` on every route's `body`, `params`, `query`. Lists cursor-paginated, max 50, index-backed.

## Auth rules
- Sign-in is Auth0 only: Google (`google-oauth2`) and email OTP (`email`). No passwords, JWT signing or OTP of our own.
- Chain: `authenticate` (RS256) -> `loadUser` (MongoDB every request) -> `requireActive` -> `requireVerifiedEmail`
  -> `requirePermission(perm)` -> scope applied inside the service's DB query. Pure rules in `utils/permissions.js`.
- The database is the source of truth for `role`, scope (`cityId`, `departmentId`, `stateCode`) and `status`;
  never read them from the token or body.
- Out of scope or missing `:id` is **404** with an identical body, never 403.
- Nobody grants, changes or suspends a level >= their own, and nobody changes themselves.
- Every role or status change writes an AuditLog row in the **same transaction** as the user update.
- Admin writes follow the Auth0 order in `docs/phase-1-auth.md` 7.2 (MFA flag first when raising to level >= 4;
  cleared after the transaction when lowering).
- Client tokens live in memory only, never localStorage/sessionStorage.
- `services/auth0ManagementClient.js` is mocked only in tests. M2M secrets stay server-side, never logged.

## Never
- Never commit, push, deploy or delete files without asking Sachin first.
- Never read or print `server/.env` or `client/.env`; secrets live only there.
- Never add a dependency not listed in `docs/CONVENTIONS.md` without asking.
- Never trust `role`, `cityId`, `departmentId` from the client; never send stack traces.
- Never add a top-level folder without asking.

## Working rules
- Plan mode before any change touching more than one file. Explain non-obvious code line by line.
- Keep files under ~200 lines; split by responsibility.
- Every bug fix comes with a test that failed before the fix. Done = tests pass and lint is clean in both apps.
- Living docs: after each feature, update `docs/API.md`, `docs/DECISIONS.md`, and the BUILT/DESIGNED tags plus
  the diagrams for that area in `docs/ARCHITECTURE.md`.

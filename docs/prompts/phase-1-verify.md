# Phase 1 verification: sign-in, user creation, identity linking

Context: Nivaran v2 (MERN). Login is only Google (google-oauth2) and Auth0 email code (connection "email").
The API listens on 5001 and the client on 5173. macOS AirPlay owns port 5000, so nothing may use 5000.
A user is created on the first successful GET /api/me. One user per verified email, with every login id in auth0Ids.

Global rules for every step:
- Use `graphify query` before opening files. Do not read server/.env or client/.env. Compare key NAMES only.
- Never print secrets, tokens or full emails. Mask emails as s***@gmail.com.
- Do not start long-running servers yourself. If the dev server is not up, ask me to run `npm run dev` in another terminal.
- Read-only until Step 4. No edits, commits or pushes before I approve a plan.
- Follow Ponytail: minimal change, reuse existing code first. Report in under 25 lines as a PASS/FAIL table with evidence.

## Step 1: Environment and backend health (read-only)
1. Key names: compare names in server/.env.example vs server/.env, and client/.env.example vs client/.env, using
   `diff <(grep -oE '^[A-Z_]+' A | sort) <(grep -oE '^[A-Z_]+' B | sort)`. Report missing names only.
2. Ports: `lsof -nP -iTCP:5001 -iTCP:5173 -sTCP:LISTEN`. Both must be node. Also confirm nothing in the repo
   (excluding node_modules and .git) still points at localhost:5000 or PORT=5000.
3. API: `curl -i http://localhost:5001/api/health` must return 200 with db "up".
   `curl -i http://localhost:5001/api/me` must return 401 with body {"error":{"code":"UNAUTHENTICATED","message":...}}.
4. CORS: `curl -i -H "Origin: http://localhost:5173" http://localhost:5001/api/health` must include
   Access-Control-Allow-Origin: http://localhost:5173. A request with Origin http://localhost:5174 must NOT be allowed.
5. Git hygiene: current branch, `git status --short`, and `git ls-files | grep -E '(^|/)\.env($|\.)'` must list only .env.example files.
6. Tests: run only the affected suites: server identityLink and migrateUsersV2, plus the client auth and useMe tests.

## Step 2: Frontend sign-in visibility (read-only)
Symptom: the Sign in button is not visible on http://localhost:5173.
1. `graphify query` for AuthProvider, the header, the sign-in sheet and useMe. Trace every condition that hides the
   Sign in button: Auth0 isLoading, isAuthenticated, the `expired` flag, and useMeQuery error or loading states.
2. Specific hypothesis to prove or reject: a stale Auth0 session in localStorage (from before the port fix) makes
   isAuthenticated true, while GET /api/me fails because the old API URL answered 403 with an empty non-JSON body.
   Check what the UI shows in that state. A dead end (no Sign in, no Sign out, no error, no retry) is a bug.
3. Check how the API client parses error responses. A 403 or 5xx with an empty or non-JSON body must not throw an
   unhandled JSON parse error. It must map to the same { error: { code, message } } shape.
4. Use the Playwright MCP in a fresh context (no stored session):
   - Open http://localhost:5173 and assert the header Sign in button is visible.
   - Click it. The sheet must show exactly two options: Continue with Google and Continue with email.
   - Keyboard: Tab reaches both, Esc closes the sheet, and focus returns to the Sign in button.
   - Console must have zero errors. Take screenshots at 375px and 1280px wide.
   Do not attempt a real login.
5. Report the root cause with file:line, not just a symptom.

## Step 3: Real login and identity linking (needs me)
1. Stop and give me these exact manual steps, then WAIT for me to reply "done":
   a. Private window, http://localhost:5173, Sign in, Continue with Google, finish.
   b. Sign out. Sign in again, Continue with email, same Gmail, enter the code.
2. After "done", verify read-only with a one-off `node -e` using the server's existing db config and models.
   Do not create files and do not print the connection string. Report:
   - users count (expected 1) and, per user: masked email, emailVerified, the PREFIX of each auth0Id
     (google-oauth2| or email|, never the full id), accessLevel, createdAt, lastLoginAt.
   - auth0Ids length must be 2, with one google-oauth2| and one email|.
   - collection indexes: unique on auth0Ids, plus the partial unique index on verified email.
3. Server log check: GET /api/me returned 200 for both logins, with no 401, 403 or 500.
4. Negative cases, by reading the code and tests rather than hitting live data:
   - an UNVERIFIED email must never be linked to an existing account;
   - a sub longer than 128 characters or a missing sub gives 401;
   - role, scope and status come from MongoDB and never from token claims.

## Step 4: Fix plan (approval gate), then implementation
For every FAIL from Steps 1-3, write: root cause (not just the corrected code), minimal fix, files touched, tests to add.
Present the plan and WAIT for my approval. Only then implement.

Backend design rules:
- Keep the layering route, controller, service, model. No business logic in routes.
- First-login creation must be idempotent and race-safe. In dev, React StrictMode can fire two concurrent
  GET /api/me calls. The unique index must make the second insert fail with E11000, and the service must catch it
  and re-read the existing user instead of returning 500.
- Validate input with Zod. Errors use { error: { code, message } } with the right HTTP status.
- Logs are structured and never contain tokens, full emails or secrets.

Frontend design rules:
- Every auth state has a designed UI: loading (skeleton, no layout jump), signed-out (Sign in visible),
  signed-in, and a /api/me failure state with a clear message, Retry, and Sign out. Never a dead end.
- The Sign in button must not flicker in and out while Auth0 is loading.
- API client: handle empty or non-JSON error bodies and network failures gracefully.
- Accessibility: focus trap in the sheet, Esc to close, labelled buttons, visible focus ring, and it works at 375px.
- Smooth, consistent motion and spacing using the existing design tokens (see DESIGN.md if present).

After approval: implement, add or adjust tests, run only the affected tests, `graphify update .`.
Do not commit or push. Then run /ponytail-review (high and medium findings only).

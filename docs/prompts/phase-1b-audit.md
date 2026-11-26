# Phase 1b: Audit (read-only). Find out what actually exists before building more.

Context: Nivaran v2, MERN (React + Vite, Express 5, MongoDB Atlas, Auth0). Phase 1 works: Google and email-code
sign-in, GET /api/me creates the user, one user per verified email. The API runs on 5001, the client on 5173.
The UI feels unfinished and the backend's real state is unclear.

Rules for every step:
- Read-only. Do NOT edit, install, commit or push anything.
- Use `graphify query` first and open files only when needed. Do not read .env files. Mask emails.
- Report as tables, under 30 lines per step. Evidence means file:line, not impressions.

## Step 1: Backend inventory
1. List every route: method, path, auth requirement, minimum access level, grouped by feature.
   Mark each one implemented, stub or missing. Use the route files, not guesses.
2. List every Mongoose model: fields, indexes, relations. Flag missing indexes: 2dsphere where geo data is stored,
   unique constraints, compound indexes for the common queries.
3. For each feature, say what exists and what is missing: pincodes and areas, issue reports, departments and routing,
   tickets with a status timeline, expected-by date, photo upload, community posts, chatbot (Gemini), admin and
   moderation, notifications.
4. Layering and quality check: business logic inside routes or controllers, missing Zod validation, error bodies that
   are not { error: { code, message } }, public routes without rate limits, routes reachable without auth that
   should not be.
5. Tests: count per area, name the features with no tests. Run `npm test -w server` and report totals only.

## Step 2: Frontend inventory
1. List pages and routes, shared components, the design tokens (colors, type, spacing, radius, shadows), and how
   styling is done (Tailwind, CSS modules, plain CSS, a component library). Say which animation library is
   installed, if any, and the production bundle size from `npm run build -w client`.
2. For every page, mark whether it has loading, empty, error and signed-out states.
3. Find dead-end or placeholder screens ("isn't ready yet", "Sample numbers", hardcoded stats) and list what real
   data each one needs.
4. Accessibility basics: skip link, visible focus ring, keyboard path through the pincode input and the sign-in
   sheet, labels, contrast of muted text on its background, and whether prefers-reduced-motion is honoured.
5. If the Playwright MCP is available, screenshot Home, Report, My issues and Community at 375px and 1280px.
   If it is not, say so and ask me whether to add it (`claude mcp add playwright npx @playwright/mcp@latest`).
   Do not install anything without my yes.

## Step 3: Gap report and build order (no edits)
1. A table: feature, backend state, frontend state, blocker, effort (S, M, L).
2. Propose the build order with reasons. The report flow depends on pincodes, so pincodes come first.
3. List the decisions I must make before building (department list, how the expected date is computed, where photos
   are stored, which languages the UI needs).
4. Show everything in chat, then wait for me.

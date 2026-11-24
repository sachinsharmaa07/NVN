# ADR 0001: Stack and dependencies

**Status:** Accepted, 24 Nov 2026

## Context
Nivaran v2 is built by one student, for Indian cities, on free tiers, step by step with Claude Code.
Users are often on mid-range phones and slow 4G. The code must stay small enough to understand
line by line. Every library is one more thing to learn, upgrade and debug, so each must earn its place.

## Decision
**Runtime and languages:** Node 22 LTS, Express 5 (ES modules), React + Vite in JavaScript (no
TypeScript). MongoDB Atlas only (`MONGODB_URI` for dev, `MONGODB_URI_TEST` for tests); no Docker.
Two apps (`client/`, `server/`) in npm workspaces with root scripts (`dev`, `check`, ...) and one lockfile
(changed 24 Nov 2026 by the Phase 0 brief; see "Phase 0 brief changes" below).

**Server dependencies**
| Package | Why |
|---|---|
| express (5) | HTTP framework; v5 forwards async errors to the error handler |
| mongoose | Schemas, indexes and transactions on Atlas |
| zod (4) | Request and env validation; our runtime contracts since there is no TypeScript |
| pino | Fast JSON logs; a ~10-line middleware adds the request id (`crypto.randomUUID()`) |
| helmet | Safe HTTP headers in one line |
| express-rate-limit | Per-user / per-IP limits on reports, posts, chat; hand-rolled limiters are easy to get wrong |

**Client dependencies**
| Package | Why |
|---|---|
| react, react-dom | UI library |
| react-router | Page routing |
| @tanstack/react-query | Server state, caching, optimistic updates with rollback |
| tailwindcss (4) | Styling with tokens from docs/UI.md |
| radix-ui, class-variance-authority, clsx, tailwind-merge, tw-animate-css | What shadcn/ui components are built on (added by the shadcn CLI as needed) |
| react-hook-form, @hookform/resolvers | What shadcn's `Form` is built on; validates with the same Zod schemas as the server |
| lucide-react | Icons (status badges always show icon + label) |
| sonner | Toasts, the shadcn default |
| vaul | shadcn `Drawer`: mobile bottom sheets with drag to dismiss (builds on Radix Dialog, ~5 KB gzip est.) |
| leaflet | Map and draggable pin, wrapped in one small `useEffect` component |
| @fontsource/* | Self-hosted fonts chosen in docs/UI.md; only the variable fonts and Latin + Devanagari subsets |

**Dev dependencies:** vite, vitest, supertest, eslint. `.editorconfig` covers basic formatting.

**Added with their phase (not at scaffold):**
| Package | Phase | Why |
|---|---|---|
| express-oauth2-jwt-bearer, @auth0/auth0-react | Auth | JWT verification is the wrong place to be clever; use the official libraries |
| @google/genai | Chatbot | Official Gemini SDK |
| @number-flow/react | Dashboards | Animated KPI numbers on dashboard tiles only, lazy-loaded with that route (~5-8 KB gzip est.) |
| @base-ui-components/react | When a screen needs it | Only for a primitive Radix lacks (combobox, number field); each use recorded here |
| Magic UI components (copy-paste, no package) | Home page polish | Public Home and success counterfoil only; CSS-only first; `motion` only with approval (~15-35 KB gzip est.) |
| @playwright/test | Report wizard | Downloads browsers; nothing to test end to end before then |
| marked + sanitize-html (together) | Community, only if posts need formatting | Default is plain text rendered with `whitespace-pre-wrap`, which React escapes, so there is no HTML to sanitise |

**Built in-house instead of a package** (each small and unit-tested):
- Request-id middleware (pino-http logs each request using that id).
- Cloudinary signed-upload signature with `node:crypto` (replaces the cloudinary SDK; add the SDK only for server-side deletes or transforms).
- SLA check with `setInterval(...).unref()` every few minutes (replaces node-cron; no calendar schedule is needed).
- Point-in-polygon for the client-side pincode check in `utils/geo.js`, handling Polygon, MultiPolygon and holes (replaces Turf). The server's `$geoIntersects` stays the source of truth.
- i18n: a small `t(key)` helper reading `client/src/i18n/en.json`. Keys look like `report.wizard.title`. Switch to a library only when Hindi actually ships.

UI libraries requested by Sachin on 24 Nov 2026 (Base UI, Vaul, NumberFlow, Magic UI) were reviewed the same way: Radix stays the only primitive layer, and each extra library is limited to the scope in docs/UI.md §6.1.

These cuts came from a boring-tech review (24 Nov 2026). Any of them can be reversed with a one-line ADR update if the in-house version becomes a burden.

**Deferred, not in v2 initial scope:** Socket.IO. DESIGN.md §0 lists "Socket.IO rooms" from v1, but
no v2 phase needs live push yet; TanStack Query refetching covers status updates. Revisit with its
own ADR if real-time is needed (it also needs a multi-instance adapter).

## Phase 0 brief changes (24 Nov 2026)
Sachin's Phase 0 brief replaced some boring-tech cuts above; Sachin chose "follow the brief, update the docs".

| Change | Why |
|---|---|
| npm workspaces + root scripts (`concurrently` for `npm run dev`) | One install, one lockfile, one command to run both apps |
| Prettier (+ eslint-config-prettier) | Consistent formatting checked in CI |
| pino-http | Per-request logs with less hand-written code |
| dotenv | Loads `server/.env` (Node's `--env-file` would also work) |
| cors with an allow-list (`CLIENT_URL`) | Client calls `VITE_API_URL` directly instead of a Vite proxy |
| Global express-rate-limit from Phase 0 | Basic abuse protection on every route; tighter limits per route later |
| eslint-plugin-react, -jsx-a11y, -n | React, accessibility and Node rules in lint |
| Vitest + Testing Library + jsdom in the client | Component tests (Home loading, ok, error) |
| Server port 5000 | Brief's choice. macOS AirPlay Receiver also uses 5000; set `PORT` if it clashes |
| Build tooling: @vitejs/plugin-react, @tailwindcss/vite, @eslint/js, globals, eslint-plugin-react-hooks, -react-refresh | Needed by Vite, Tailwind v4 and ESLint; no runtime code |

`motion` and `@number-flow/react` were added with the visual foundation (24 Nov 2026, Sachin's request): motion for page transitions and scroll reveals, NumberFlow for KPI tiles and the Landing stats row. No smooth-scroll library (see UI.md §4).

## Consequences
- **No TypeScript:** Zod schemas plus JSDoc on service functions carry the contracts. Shared shapes
  live in Zod schemas, not in comments.
- **Atlas only:** tests need network and a separate test database; no offline development.
  Atlas replica sets give transactions with no setup.
- **Single server instance (known limit):** the in-memory rate-limit store and the in-process
  SLA timer are only correct with one instance. Later fix: a Mongo-backed rate-limit store and a
  cron lock document (`findOneAndUpdate` with an expiry) so only one instance runs the SLA job.
- Adding any package not listed here needs Sachin's approval and an update to this ADR and CLAUDE.md.

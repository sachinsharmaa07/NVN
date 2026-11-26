# M1: Core loop (pincode and report)

Exit criteria (from `docs/PLAN.md`): a resident signs in, enters a pilot pincode, pins inside the boundary, submits,
and sees ticket ID, department and expected-by date. A pin outside the area is refused (client AND server). Tests
pass. `docs/API.md` has curl examples. Duplicate grouping is NOT in M1.

Run with `/step m1-core-loop.md <n>`. `/clear` between steps. Branch: `feat/m1-core-loop` (one PR at the end, or one
PR per 2 to 3 steps if it grows).

## Common rules

Architecture
- route, controller, service, model. Controllers never touch Mongoose. Services get plain values (`actor`, `input`),
  never `req`. `utils/` stays pure.
- Zod `.strict()` on body, params and query. Error shape `{ "error": { "code", "message", "details"? } }`.
  New error codes go into `client/src/i18n/en/errors.json` (and `hi/errors.json`) in the same step.
- Scope inside the DB query. Out of scope and missing both return 404 with the same body.
- Indexes declared in the model, built by a migration script (dry run by default, `--apply` to write).
  `autoIndex` is off in production.
- Writes are idempotent: unique indexes, catch E11000, re-read.
- Logs: no tokens, no full emails, no photo URLs with signatures, no coordinates at `info` level.

Frontend
- Never hardcode a colour, font, z-index or duration. Use tokens from `globals.css` and `lib/motion.js`.
- Every string behind `t("area.screen.key")`, with an English AND a Hindi value from M1 on.
- Mobile first (360 px). Touch targets 44 px. Visible label on every field. `aria-live` for lookups and errors.
- Pages never import Auth0; use `useAuth`, `useCan`, `useApi`.

Process
- Use context7 for current docs of Mongoose 9, Express 5, React Router 8, TanStack Query 5, Leaflet, Zod 4 before
  writing code against them.
- New dependency: ask first, with size and why an in-house version is worse (ADR 0001).
- Skills: backend steps `backend-design:think-before-coding`; schema steps `backend-design:data-modeling-discipline`
  and the `schema-reviewer` agent; write steps `backend-design:idempotency-and-side-effects`; UI steps
  `frontend-design`, then `design:accessibility-review`.
- No commit, push, delete or `--apply` against `nivaran_dev` without my approval. Tests use `nivaran_test` only.

---

## Step 1: Lock decisions [PLAN FIRST]

The docs disagree. Propose one answer per row, with a one-line reason, and STOP for my approval. After approval,
write them into `docs/DECISIONS.md`.

| Topic | Option A | Option B |
|---|---|---|
| Ticket ID format | `NIV-YYYY-NNNNNN` (architecture) | `NVN-YYMMDD-NNNNN` (handoff) |
| Issue status enum | `submitted, assigned, in_progress, resolved, closed, reopened, rejected` + `slaPausedAt` flag (architecture) | `reported, received, in_progress, on_hold, fixed, closed, reopened` (handoff and plan M2) |
| Pilot city | the city I name (suggest one with a pincode boundary file available) | |
| Boundary source | AIKosh / open GeoJSON for the pilot pincodes | hand-drawn in geojson.io, `boundarySource: "manual"` |
| Waitlist email | HMAC only (cannot email later) | AES-GCM encrypted + HMAC for dedupe (can notify when the pincode opens) |
| Default theme | light | dark |

Also confirm the category list (pothole, garbage, streetlight, water leak, drainage, stray animals, other) and that
"other" always goes to triage.

## Step 2: Design system check and Hindi keys

Do:
- Apply the theme decision (default in `ThemeProvider` and the pre-paint script in `index.html`).
- Create `client/src/i18n/hi/*.json` mirroring every `en/*.json` file. Machine draft is fine; mark it with a
  `"_review": true` key per file.
- Make `t()` pick `hi` when `user.preferredLanguage === "hi"`, else `en`, with fallback to `en` for a missing key.
- Add a test: every key in `en` exists in `hi` (a key-parity test that fails the build).

Checks: client tests pass; `/dev/styleguide` renders in both themes and both languages (screenshot 360 px and
1280 px with Playwright MCP).

## Step 3: Pincode, City, Department models [PLAN FIRST]

Do:
- `Pincode`: `pin` (unique, `^[1-9][0-9]{5}$`), `district`, `state`, `cityId` (nullable), `localities[]`,
  `centroid` (GeoJSON Point), `boundary` (Polygon or MultiPolygon, optional), `boundarySource`
  (`aikosh | manual | none`), `isServed` (bool). Indexes: `pin` unique, `boundary` 2dsphere (sparse-safe),
  `{ cityId: 1, isServed: 1 }`.
- Complete `City` (`status: active | onboarding`) and `Department` (`categories[]` is NOT here; mapping is its own
  collection in step 6). Keep the existing delete guards.
- `Waitlist`: `pin`, `emailHash` (HMAC-SHA-256 with `HMAC_SECRET`), plus `emailEnc` only if decided in step 1.
  Unique `{ pin, emailHash }`.
- Add `HMAC_SECRET` (and the encryption key if chosen) to `config/env.js` and `server/.env.example`. Tell me the
  command to generate it: `openssl rand -hex 32`. Do not touch `.env`.
- Migration script `server/scripts/migrateM1Indexes.js` + `npm run migrate:m1-indexes -w server`, dry run default.

Checks: unit tests for validators (bad pin, empty string, invalid polygon rejected); run `schema-reviewer` on the
three models and paste its high findings.

## Step 4: Import pincodes and pilot boundaries [PLAN FIRST]

Inputs (I place them; you never download): `data/pincodes.csv` (data.gov.in All India Pincode Directory) and
`data/boundaries/<city>.geojson`.

Do:
- `server/scripts/importPincodes.js`: stream the CSV (no full read into memory), group rows by pincode, upsert with
  `bulkWrite` in batches of 500, `localities` = unique office names. Dry run prints counts only; `--apply` writes.
  `--city <CODE>` marks that city's pincodes `isServed: true` and sets `cityId`.
- `server/scripts/importBoundaries.js`: read the GeoJSON, match features to pincodes, validate rings (closed, at
  least 4 points, lon/lat order), set `boundary`, `boundarySource`, and `centroid`. Report pincodes with no polygon.
- Both idempotent: a second `--apply` changes 0 documents.
- Before committing `data/pincodes.csv`, report its size. If over 10 MB, add it to `.gitignore` and document the
  download in `README.md`.

Checks: tests with a 20-row fixture CSV and a 2-feature fixture GeoJSON; second run reports 0 modified.

## Step 5: Pincode and waitlist API

Do:
- `utils/geo.js`: pure point-in-polygon (ray casting, supports holes and MultiPolygon). Tests: inside, outside,
  on a hole, on an edge, across longitude order mistakes.
- `GET /api/pincodes/:pin` (public, rate-limited 30/min/IP): returns `pin, district, state, localities, isServed,
  cityName, boundary, centroid`. Unknown pin: 404 `PINCODE_NOT_FOUND`. Bad format: 400 `INVALID_PINCODE`.
  Cache header `public, max-age=86400` for served pins.
- `POST /api/pincodes/:pin/check-point` `{ lat, lng }`: uses MongoDB `$geoIntersects`; returns `{ inside }`.
  No boundary: fall back to a 2 km radius around the centroid and return `{ inside, precision: "approx" }`.
- `POST /api/waitlist` `{ pin, email }` (public, 5/hour/IP): idempotent (same pin and email returns 200, not 409).
- Fallback to `api.postalpincode.in` is OUT of M1 (pilot city only). Note it in `docs/DECISIONS.md`.
- Start `docs/API.md` with curl examples and expected responses for these three routes.

Checks: Supertest for every status code above; route inventory test updated.

## Step 6: Routing, SLA and ticket counter (pure logic first)

Do:
- `Category` list as a constant in `utils/categories.js` (id, i18n key, icon name).
- `CategoryMapping` collection: `{ cityId, category, departmentId }`, unique `{ cityId, category }`. Seed script
  for the pilot city (dry run default). Unmapped or `other` resolves to the city triage queue (`departmentId: null`,
  `queue: "triage"`).
- `SlaPolicy`: `{ cityId (null = national default), category, resolveHours }`. Seed national defaults.
- `utils/expectedBy.js` (pure): `computeExpectedBy({ createdAt, resolveHours })` in calendar hours, returned as UTC,
  formatted on the client in `Asia/Kolkata`.
- `Counter` `{ _id: "issue-<YYYY>", seq }` with atomic `findOneAndUpdate({ $inc }, { upsert: true, new: true })`,
  used inside the issue transaction. Format per step 1 decision. Never `count + 1`.

Checks: unit tests for `expectedBy` (DST-free IST, month end, leap day), counter concurrency test (20 parallel
calls produce 20 unique, gap-free numbers in a fresh test DB).

## Step 7: Photo upload signing [PLAN FIRST]

Do:
- `POST /api/uploads/sign` (requires `issue:create`, 20/hour/user): returns Cloudinary signed params built with
  `node:crypto` (no SDK): `timestamp`, `folder: nivaran/<env>/reports`, `allowed_formats: jpg,png,webp,heic`,
  `max_file_size: 5242880`, and an incoming transformation that strips metadata (EXIF and GPS).
- Server never receives the file. On submit the server re-checks each `public_id` starts with the signed folder and
  belongs to our cloud name (no arbitrary URLs).
- Env names only: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in `config/env.js` and
  `.env.example`.

Checks: signature test against Cloudinary's documented algorithm (fixed timestamp fixture); a request with a foreign
`public_id` is 400 `INVALID_PHOTO`.

## Step 8: Issue model and POST /api/issues [PLAN FIRST]

Do:
- `Issue`: `ticketId` (unique), `reporterId`, `cityId`, `pincode`, `location` (Point, 2dsphere), `category`,
  `departmentId` (nullable), `queue` (`department | triage`), `title`, `description` (20 to 1000 chars), `photos[]`
  (max 3: `publicId`, `width`, `height`), `status` (initial value per step 1), `statusHistory[]`, `expectedBy`,
  `idempotencyKey` (unique per reporter). Indexes: `ticketId` unique, `location` 2dsphere,
  `{ reporterId: 1, createdAt: -1 }`, `{ cityId: 1, queue: 1, status: 1, createdAt: -1 }`,
  `{ reporterId: 1, idempotencyKey: 1 }` unique.
- `POST /api/issues` (requires `issue:create`, verified email, `Idempotency-Key` header as a UUID): Zod, served
  pincode check, server `$geoIntersects` re-check (422 `OUTSIDE_PINCODE`), photo check, then ONE transaction:
  counter, routing, expectedBy, insert, AuditLog `issue.created`. Same key again returns the first issue with 200.
- `GET /api/issues/:ticketId` for the reporter only (others get 404). Full tracking UI is M2.
- Add curl examples to `docs/API.md`.

Checks: tests for happy path, outside pin, unserved pincode, replayed key, 4 photos, foreign photo, other user's
ticket is 404, triage routing for `other`. Run `backend-design:security-reviewer` on the diff.

## Step 9: Report wizard, step 1 (pincode) and waitlist

Do:
- `/report?step=1..3`, Back works, `sessionStorage` draft survives refresh (never photos or tokens in it).
- Reuse the landing `PincodeInput` (one input, six boxes look). Lookup on 6 digits with `useQuery`, result
  announced by `aria-live`. Never auto-advance.
- Unserved: inline waitlist form, success copy says what happens next.
- Landing `?pincode=` prefill.

Checks: component tests for valid, invalid, unserved, network error; Playwright screenshots at 360 and 1280.

## Step 10: Report wizard, step 2 (map pin) [PLAN FIRST]

Needs `leaflet` (ask me before installing; no `react-leaflet` unless you justify it).
Do:
- Map fitted to the boundary (`animate: false`), outside area dimmed, outline 2 px `primary`, OSM tiles with
  attribution, `isolation: isolate` on the container.
- Drag or tap places the pin. Outside: snap back plus an announced message. Client uses `utils/geo` logic
  (shared copy or a client port with the same tests).
- "Use my location" (browser geolocation, shows accuracy), arrow-key nudge, and a Locality select as non-map input.
- Lazy-load Leaflet only on this step. Chat bubble hidden on this step.

Checks: unit tests for the inside/outside guard; manual check list for me (iPhone-size viewport, keyboard only).

## Step 11: Report wizard, step 3 (photos, details, submit, counterfoil)

Do:
- Category radio cards with icons. Description with live count (20 min). Up to 3 photos: compress in the browser to
  max 1600 px (canvas, no library), read GPS before stripping only to offer "move pin here".
- Upload each photo directly to Cloudinary with signed params, show per-photo progress and retry.
- Review panel, then Submit with one `Idempotency-Key` generated per draft (`crypto.randomUUID()`), so a retry or
  double tap never makes two tickets. Never optimistic.
- Success: the counterfoil (ticket ID in display font, department or "City triage", expected-by in IST,
  Copy ticket ID, "Track this issue" linking to a placeholder for M2). Clear the draft.

Checks: tests for double-submit, upload failure, server 422 shown on the map step; Playwright run of the whole
flow with a test user against `nivaran_test` data.

## Step 12: M1 exit review

Do:
- Run `npm run check`, then `design:accessibility-review` on the three wizard steps and the counterfoil.
- Run `/ponytail-review` (high and medium only) and `backend-design:security-reviewer` on the M1 diff.
- Verify each exit criterion and print a pass/fail table with the evidence (test name, screenshot path, curl).
- Update `docs/ARCHITECTURE.md` status tags (DESIGNED to BUILT) for what M1 built.
- Print the PR title and body (summary, screenshots list, test counts, migration commands to run in order). Do not
  push.

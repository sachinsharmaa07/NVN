# Phase 2: Backend build-out (pincodes, then reports)

Run the Phase 1b audit first and use its gap report. Where the audit shows a step is already done, say so and skip it.
Use `graphify query` before opening files. Follow Ponytail: minimal diffs, reuse first.
Do not read .env files. Do not commit or push. Report each step in under 15 lines.

## Backend design rules (apply to every step)
- Layering: route, controller, service, model. No business logic in routes.
- Validate every input with Zod. Errors use { error: { code, message } } with the correct HTTP status.
- Indexes are defined in the model and created by a migration script (dry run by default, --apply to write),
  never by auto-indexing in production.
- Writes are idempotent. Unique indexes protect them, and the service catches E11000 and re-reads instead of
  returning 500.
- Public routes get rate limits. List endpoints are paginated with a capped page size.
- Structured logs never contain tokens, full emails or secrets.
- Tests use the nivaran_test database only. Add tests for every new service function and route.
- Plan first if more than 3 files change, and wait for my approval.

## Step 1: Pincode model and indexes
Model for a pincode area: pincode (6-digit string, unique), state, district, localities[], centroid (GeoJSON Point,
2dsphere index), optional boundary (GeoJSON Polygon). Add the migration script and its test.

## Step 2: Import script
`npm run import:pincodes -w server` reads data/pincodes.csv (data.gov.in postal data). Dry run by default and
--apply to write. Upsert in batches with bulkWrite, so a rerun changes nothing. Print counts of rows read,
inserted, updated and rejected, plus the first 5 rejection reasons. Test it on a tiny fixture CSV.

## Step 3: GET /api/pincodes/:pin
Validate with ^[1-9][0-9]{5}$. Look up the database first. If the pincode is missing, fall back to
api.postalpincode.in with a 3-second timeout and store the result so the next lookup is local. Error codes:
INVALID_PINCODE (400), PINCODE_NOT_FOUND (404), UPSTREAM_UNAVAILABLE (503). Response: pincode, state, district,
localities, covered (boolean). Rate-limit the route. Test the fallback with a mocked upstream, never the real one.

## Step 4: Is this point inside the area?
POST /api/pincodes/:pin/check-point with { lat, lng }. Use a 2dsphere $geoWithin on the boundary when one exists.
When there is no boundary, fall back to a configurable maximum distance from the centroid. Say in your plan which
radius you propose and why, and let me decide. Validate coordinates and return { inside, distanceMeters }.

## Step 5: Waitlist for uncovered pincodes
POST /api/waitlist with { pincode, email }. Store an HMAC of the email using HMAC_SECRET (generate with
`openssl rand -hex 32`, and add the key to server/.env.example without a value). Unique on pincode plus the
HMAC, idempotent, rate-limited. Tell me the trade-off before building: an HMAC lets us deduplicate but not
email people later. If I want to notify them, the email needs encrypting instead. Wait for my choice.

## Step 6: Reports (issues)
Issue model: reporter (user ref), pincode, location (GeoJSON Point, 2dsphere), category, department, title,
description, photos[], status (enum), statusHistory[] (status, by, at), ticketId (human-readable and unique,
generated from a counter, for example NVN-251125-00042), expectedBy (date from a per-category SLA config),
createdAt. Endpoints:
- POST /api/issues: the point must be inside the pincode area (reuse Step 4), the department is routed by category
  and pincode, and an Idempotency-Key header prevents a double submit. Rate-limit per user.
- GET /api/issues/mine: cursor pagination.
- GET /api/issues/:ticketId: only the owner or staff with a sufficient access level.
- PATCH /api/issues/:ticketId/status: staff only, level checked from MongoDB, never from the token. Append to
  statusHistory and write an audit log entry.
Ask me before choosing the photo storage (local disk for development, S3 later) and show the options.

## Step 7: Docs and seed data
Write docs/API.md with each endpoint, a curl example and the expected output. Add a dev seed script for a few
pincodes and sample issues, with dry run by default. Run the full server tests, `graphify update .`, then
/ponytail-review (high and medium findings only).

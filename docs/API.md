# Nivaran API

Base URL locally: `http://localhost:5001`. Every error has the shape
`{ "error": { "code": "UPPER_SNAKE", "message": "...", "details"?: ... } }`.
Living document: update it with every feature (see `CLAUDE.md`, "Living docs").

## Pincodes

### GET /api/pincodes/:pin

Public, 30 requests per minute per IP. `Cache-Control: public, max-age=86400`. Report step 1.

```bash
curl -s http://localhost:5001/api/pincodes/144601
# 200 {"pin":"144601","district":"Kapurthala","state":"Punjab","cityName":"Kapurthala",
#      "localities":["Kapurthala","Sultanpur Road"],"centroid":{"type":"Point","coordinates":[75.38,31.38]},
#      "radiusM":4000,"boundary":null,"precision":"approx","served":true}

curl -s http://localhost:5001/api/pincodes/044401
# 400 {"error":{"code":"INVALID_PINCODE","message":"A pincode is 6 digits and does not start with 0."}}
```

`precision` is `exact` when `boundary` is a polygon, else `approx` (circle `radiusM` around `centroid`).
A known pincode we do not serve yet is `200` with `served: false` (and `cityName: null`): offer the waitlist.

| Status | Code | When |
| --- | --- | --- |
| 400 | `INVALID_PINCODE` | Not 6 digits, or starts with 0 |
| 404 | `PINCODE_NOT_FOUND` | Not in the directory (offer the waitlist) |
| 429 | `RATE_LIMITED` | More than 30 lookups a minute from one IP |

### POST /api/pincodes/:pin/check-point

Public (no sign-in), 60 requests per minute per IP. Is a map pin inside this pincode? Decision M1-7.

Body: `{ "lat": number, "lng": number }` (WGS84 degrees, no other keys).

Response `200`: `{ "inside": boolean, "precision": "exact" | "approx" }`

| `precision` | Meaning |
| --- | --- |
| `exact` | The pincode has a polygon (`boundarySource` `manual` or `aikosh`); the pin was tested against it with MongoDB `$geoIntersects`. |
| `approx` | No polygon yet. The pin was tested against a circle around the pincode's centroid with radius `radiusM` (farthest GeoNames place + 1.5 km, 3 to 25 km). The client should say the check is approximate. |

```bash
curl -s -X POST http://localhost:5001/api/pincodes/144401/check-point \
  -H 'Content-Type: application/json' -d '{"lat": 31.2235, "lng": 75.7752}'
# 200 {"inside":true,"precision":"approx"}

curl -s -X POST http://localhost:5001/api/pincodes/999999/check-point \
  -H 'Content-Type: application/json' -d '{"lat": 31.2, "lng": 75.7}'
# 404 {"error":{"code":"PINCODE_NOT_FOUND","message":"We don't know this pincode."}}
```

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Pin not 6 digits (or starts with 0), `lat`/`lng` missing, not numbers, out of range, or extra keys |
| 404 | `PINCODE_NOT_FOUND` | Pincode not in the directory |
| 422 | `PINCODE_NOT_SERVED` | Pincode known but not served (no coordinates, e.g. imported from the CSV only) |
| 429 | `RATE_LIMITED` | More than 60 checks a minute from one IP |

`POST /api/issues` uses the same check (`locatePoint` in `server/src/services/pincodeService.js`) and stores the
same `precision`.

## Waitlist

### POST /api/waitlist

Public, 5 requests per hour per IP. Decision O1: stores `HMAC-SHA-256(HMAC_SECRET, lowercased email)` only.
Idempotent: a repeat (any letter case) answers the same `200`, so the response never says whether an email was listed.

```bash
curl -s -X POST http://localhost:5001/api/waitlist \
  -H 'Content-Type: application/json' -d '{"pin":"110001","email":"asha@example.com"}'
# 200 {"joined":true}
```

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Bad pin or email, or extra keys |
| 429 | `RATE_LIMITED` | More than 5 a hour from one IP |
| 503 | `WAITLIST_NOT_CONFIGURED` | `HMAC_SECRET` not set |

## Uploads

### POST /api/uploads/sign

Signed in, active, verified email, permission `issue:create`; 20 per 10 minutes per user; `Cache-Control: no-store`.
Body and query must be empty. Decision 4: the browser uploads straight to Cloudinary with these values; the API
secret never leaves the server. An incoming transformation (`c_limit,w_1600,h_1600`) re-encodes the original,
which drops EXIF. Cloudinary does not enforce a size cap on these uploads, so the client checks `maxBytes` and
`POST /api/issues` checks each `public_id` with the Cloudinary Admin API: it must exist under `folder`, be at most
`maxBytes`, and be jpg/png/webp/heic. Otherwise the photo is deleted and the submit is
`400 INVALID_PHOTO` (`details.index` names the photo); Cloudinary unreachable is `503 UPSTREAM_UNAVAILABLE`.

```bash
curl -s -X POST http://localhost:5001/api/uploads/sign -H "Authorization: Bearer $TOKEN"
# 200 {"uploadUrl":"https://api.cloudinary.com/v1_1/<cloud>/image/upload","apiKey":"123456789",
#      "allowed_formats":"jpg,png,webp,heic","folder":"nivaran/development/reports","timestamp":1795689600,
#      "transformation":"c_limit,w_1600,h_1600","signature":"<40 hex>","maxBytes":5242880}
```

Then: `POST uploadUrl` as multipart with `file`, `api_key`, `timestamp`, `folder`, `allowed_formats`,
`transformation`, `signature` (valid for about an hour).

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Any body or query key |
| 401/403 | auth codes | Not signed in, suspended, unverified, or no `issue:create` |
| 429 | `RATE_LIMITED` | More than 20 in 10 minutes |
| 503 | `UPLOADS_NOT_CONFIGURED` | `CLOUDINARY_*` not set |

## Issues

### POST /api/issues

Signed in, active, verified email, permission `issue:create`; 10 per hour per user; `Cache-Control: no-store`.
Header `Idempotency-Key: <UUID>` (one per draft). The same key from the same user returns the first issue with
`200` and writes nothing. Order: replay check, served pincode, pin check (`locatePoint`, same as check-point),
photo check (Cloudinary Admin API), then one transaction: ticket counter, routing (`other` or no mapping goes to
city triage), `expectedBy` from the city's `SlaPolicy` or the national one, insert, AuditLog `issue.created`.

```bash
curl -s -X POST http://localhost:5001/api/issues -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" -H "Content-Type: application/json" \
  -d '{"pincode":"144601","lat":31.38,"lng":75.39,"category":"pothole","title":"Deep pothole",
       "description":"A deep pothole outside the bus stand, two feet wide.","photos":["nivaran/development/reports/abc"]}'
# 201 {"ticketId":"NIV-2026-000001","status":"submitted","category":"pothole","title":"Deep pothole",
#      "pincode":"144601","precision":"approx","queue":"department","department":{"id":"...","name":"Roads"},
#      "expectedBy":"2026-12-03T06:30:00.000Z","createdAt":"2026-11-26T06:30:00.000Z"}
```

Body (strict): `pincode`, `lat`, `lng`, `category` (M1-6), `title` 5 to 100, `description` 20 to 1000, `photos`
0 to 3 public_ids from `POST /api/uploads/sign` uploads.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Bad or extra body field, 4 photos |
| 400 | `INVALID_IDEMPOTENCY_KEY` | Header missing or not a UUID |
| 400 | `INVALID_PHOTO` | Photo not ours, missing, over 5 MB or wrong format (`details.index`); the asset is deleted |
| 401/403 | auth codes | Not signed in, suspended, unverified, or no `issue:create` |
| 404 | `PINCODE_NOT_FOUND` | Unknown pincode |
| 422 | `PINCODE_NOT_SERVED` | Known pincode we don't serve |
| 422 | `OUTSIDE_PINCODE` | The pin is outside the pincode's polygon or circle |
| 429 | `RATE_LIMITED` | More than 10 in an hour |
| 503 | `UPSTREAM_UNAVAILABLE` / `UPLOADS_NOT_CONFIGURED` | Cloudinary unreachable / not set up |

### GET /api/issues/:ticketId

Signed in, active, permission `issue:read_own`. The reporter's own issue, same shape as above. Someone else's
ticket and a missing one are the same `404 NOT_FOUND`; a malformed id is `400`.

```bash
curl -s http://localhost:5001/api/issues/NIV-2026-000001 -H "Authorization: Bearer $TOKEN"
```

## Geo pickers

### GET /api/cities?stateCode=&q=&cursor=&limit=

Signed in, `user:promote`, 60 per minute per user. A city admin sees only their own city.
`stateCode` (one of the state codes), `q` (1-64 chars, anchored escaped case-insensitive name prefix),
`limit` (1-50, default 20), `cursor` (from `nextCursor`). Name order, keyset on `(name, _id)`.

```bash
curl -s "http://localhost:5001/api/cities?stateCode=PB&q=kap&limit=5" -H "Authorization: Bearer $TOKEN"
# 200 {"items":[{"id":"...","name":"Kapurthala","code":"PB-KAPURTHALA","stateCode":"PB"}],"nextCursor":null}
```

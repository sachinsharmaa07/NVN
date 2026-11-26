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

`POST /api/issues` (M1 step 8, not built yet) must use the same check (`locatePoint` in
`server/src/services/pincodeService.js`) and return the same `precision`.

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
which drops EXIF. Cloudinary cannot cap size on a signed upload, so the client checks `maxBytes` and
`POST /api/issues` must re-check the stored photo's `bytes`.

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

## Geo pickers

### GET /api/cities?stateCode=&q=&cursor=&limit=

Signed in, `user:promote`, 60 per minute per user. A city admin sees only their own city.
`stateCode` (one of the state codes), `q` (1-64 chars, anchored escaped case-insensitive name prefix),
`limit` (1-50, default 20), `cursor` (from `nextCursor`). Name order, keyset on `(name, _id)`.

```bash
curl -s "http://localhost:5001/api/cities?stateCode=PB&q=kap&limit=5" -H "Authorization: Bearer $TOKEN"
# 200 {"items":[{"id":"...","name":"Kapurthala","code":"PB-KAPURTHALA","stateCode":"PB"}],"nextCursor":null}
```

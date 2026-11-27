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

Signed in, active, permission `issue:read_own`. The reporter's own issue. Someone else's ticket and a missing
one are the same `404 NOT_FOUND`; a malformed id is `400`. M2 adds `slaState`, `onHold`, `holdReason`,
`afterPhotos`, `version` (send it back on every write) and `timeline` (actor role only, never an id or email).

```bash
curl -s http://localhost:5001/api/issues/NIV-2026-000001 -H "Authorization: Bearer $TOKEN"
# 200 {"ticketId":"NIV-2026-000001","status":"assigned","category":"pothole","title":"Deep pothole",
#      "pincode":"144601","queue":"department","expectedBy":"...","slaState":"on_track","onHold":false,
#      "version":1,"createdAt":"...","precision":"approx","department":{"id":"...","name":"Roads"},
#      "photos":[{"publicId":"nivaran/development/reports/abc","width":1600,"height":1200,
#                 "url":"https://res.cloudinary.com/<cloud>/image/upload/nivaran/development/reports/abc"}],
#      "afterPhotos":[],"holdReason":null,
#      "timeline":[{"status":"submitted","at":"...","role":"citizen","note":null},
#                  {"status":"assigned","at":"...","role":"staff","note":"Crew booked"}]}
```

### GET /api/issues/mine?cursor=&limit=

Signed in, `issue:read_own`. My issues, newest first, `limit` 1 to 50 (default 20), `cursor` from `nextCursor`.

```bash
curl -s "http://localhost:5001/api/issues/mine?limit=20" -H "Authorization: Bearer $TOKEN"
# 200 {"items":[{"ticketId":"NIV-2026-000001","status":"submitted","category":"pothole","title":"Deep pothole",
#      "pincode":"144601","queue":"department","expectedBy":"...","slaState":"on_track","onHold":false,
#      "version":0,"createdAt":"..."}],"nextCursor":null}
```

### Issue writes (M2)

Every write takes `version` (the issue's `version` you last read). Same answer shape as `GET /api/issues/:ticketId`
with `version` + 1. Status, AuditLog row and the reporter's notification commit in one transaction.
Lifecycle: `docs/ARCHITECTURE.md` 12.3.

| Route | Who | Body (strict) |
| --- | --- | --- |
| `PATCH /api/issues/:ticketId/status` | `issue:update_status`, in scope | `status`, `note?` (3 to 500), `afterPhotoPublicIds?` (1 to 3), `version` |
| `PATCH /api/issues/:ticketId/assign` | `issue:assign`, triage issue in their city | `departmentId` (same city), `version` |
| `POST /api/issues/:ticketId/confirm` | the reporter | `version` (resolved to closed) |
| `POST /api/issues/:ticketId/reopen` | the reporter | `note`, `version` (resolved to reopened, fresh `expectedBy`) |
| `POST /api/issues/:ticketId/hold` | dept_head, in scope | `reason`, `version` (sets `slaPausedAt`) |
| `POST /api/issues/:ticketId/resume` | dept_head, in scope | `version` (shifts `expectedBy` by the time held) |

Scope: staff and dept_head their department, city_admin their city (triage included). A dept_head may also
assign (only) their own city's triage issues (decision M2-10).

```bash
curl -s -X PATCH http://localhost:5001/api/issues/NIV-2026-000001/status -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved","afterPhotoPublicIds":["nivaran/development/reports/abc"],"version":2}'
```

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Bad or extra field; `rejected`/`reopen` without a note; `resolved` without an after photo; after photos with another status |
| 400 | `INVALID_TRANSITION` | No such edge (e.g. submitted to resolved), on hold, triage issue to `assigned` via status, hold when held or closed |
| 400 | `INVALID_PHOTO` | After photo not ours, missing, too big or wrong format |
| 403 | `FORBIDDEN` / auth codes | Role lacks the permission, or the edge exists but not for this role (staff rejecting, hold by non dept_head) |
| 404 | `NOT_FOUND` | Missing, out of scope, not the reporter, or a department of another city (same body) |
| 409 | `CONFLICT` | `version` is not the current one (someone else changed it) |

## Staff

### GET /api/staff/issues?status=&sla=&category=&queue=&cursor=&limit=

Signed in, verified, `issue:read_scope` (MFA for dept_head and above). staff see their department,
dept_head their department plus their city's triage (M2-10), city_admin their city with triage (`queue=triage` for only that), state_officer their state, super_admin all.
Without `status`, only open issues (`submitted, assigned, in_progress, reopened`). `sla` one of
`on_track, at_risk, breached`. Sorted by `expectedBy`, then `createdAt`; cursor-paginated, max 50.

```bash
curl -s "http://localhost:5001/api/staff/issues?sla=at_risk" -H "Authorization: Bearer $TOKEN"
# 200 {"items":[{...summary, "description":"...","departmentId":"...","location":{"lat":31.38,"lng":75.38},
#      "photos":[{"publicId":"...","width":1600,"height":1200,"url":"https://res.cloudinary.com/..."}],
#      "afterPhotos":[],"holdReason":null}],
#      "nextCursor":null}
```

Every photo (report and after, here and on the issue routes) carries `url`, Cloudinary's public delivery URL, or
`null` when uploads are not configured.

## Notifications

### GET /api/notifications?cursor=&limit=

Signed in. My notifications, newest first, max 50 per page, kept 90 days. No free text: render from `type`
(`status_changed, on_hold, resumed, sla_breached, sla_escalated`), `ticketId` and `status`.

```bash
curl -s http://localhost:5001/api/notifications -H "Authorization: Bearer $TOKEN"
# 200 {"items":[{"id":"...","type":"status_changed","ticketId":"NIV-2026-000001","status":"assigned",
#      "read":false,"createdAt":"..."}],"nextCursor":null,"unread":1}
```

### POST /api/notifications/read

Body (strict) `{ "ids": [...] }` (1 to 50) or `{}` for all of mine. Ids that aren't mine are ignored.

```bash
curl -s -X POST http://localhost:5001/api/notifications/read -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# 200 {"updated":1}
```

## Stats

### GET /api/stats

Public, `Cache-Control: public, max-age=300`, recomputed at most every 5 minutes. No personal data.

```bash
curl -s http://localhost:5001/api/stats
# 200 {"totalReports":6,"resolved":3,"medianResolutionHours":20,
#      "openByCategory":{"pothole":1,"garbage":0,"streetlight":0,"water_leak":0,"drainage":0,"other":1}}
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

### GET /api/departments?cityId=

Signed in, verified, 60 per minute per user. Departments of one city, name order (at most 500).
`user:promote` holders (role dialog): a city admin only their city (`403` for another), super_admin any.
`issue:assign` holders without `user:promote` (dept_head, to assign triage; decision M2-10): their own city only,
another city is `404 NOT_FOUND`. Anyone else `403 FORBIDDEN`.

```bash
curl -s "http://localhost:5001/api/departments?cityId=$CITY_ID" -H "Authorization: Bearer $TOKEN"
# 200 {"items":[{"id":"...","name":"Roads","code":"ROADS"},{"id":"...","name":"Water","code":"WATER"}]}
```

## Community (M3)

Plain text, newest first, cursor pages (`limit` 1-50, default 20). Reads need sign-in; writes a verified email
and `post:create`. Hidden content is visible only to its author and the city's moderators; deleted is `404`.

### GET /api/community/posts?pincode=&cursor=&limit=

```bash
curl -s "http://localhost:5001/api/community/posts?pincode=144601" -H "Authorization: Bearer $TOKEN"
# 200 {"items":[{"id":"...","pincode":"144601","title":"Streetlights out on Mall Road","body":"...",
#      "author":"Asha","mine":false,"status":"published","commentCount":2,"createdAt":"..."}],"nextCursor":null}
```

### POST /api/community/posts

Into the author's `defaultPincode` (profile). 5 per day per user. No home pincode: `400 PINCODE_REQUIRED`;
a pincode without a city: `400 PINCODE_NOT_SERVED`.

```bash
curl -s -X POST http://localhost:5001/api/community/posts -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"title":"Streetlights out on Mall Road","body":"Three lights near the market are dark."}'
# 201 {"id":"...","pincode":"144601",...,"mine":true,"status":"published","commentCount":0}
```

### GET /api/community/posts/:id, DELETE /api/community/posts/:id

`DELETE` is the author's own soft delete (`200 {"id":"...","status":"deleted"}`); anyone else gets `404`.

### GET /api/community/posts/:id/comments, POST /api/community/posts/:id/comments

Oldest first. Body `{"body":"...","parentId":"<top-level comment id>"}` (`parentId` optional, one level of
replies; a reply to a reply is `400`). 30 per hour. `DELETE /api/community/comments/:id` deletes your own.

### POST /api/community/flags

`{"targetType":"post"|"comment","targetId":"...","reason":"spam"|"abuse"|"personal_info"|"off_topic"|"other"}`.
Always `200 {"flagged":true}`; a repeat changes nothing. The third flag hides the content (audited as system).
Flagging your own is `400`. 30 per hour.

## Moderation (M3)

`post:moderate` (moderator, city_admin with MFA, super_admin). Own city only; another city is `404`.

### GET /api/moderation/queue?type=post|comment&status=hidden|published&cursor=&limit=

```bash
curl -s "http://localhost:5001/api/moderation/queue?type=post" -H "Authorization: Bearer $TOKEN"
# 200 {"items":[{"id":"...","title":"...","status":"hidden","flagCount":3,...}],"nextCursor":null}
```

### POST /api/moderation/:type/:id

`{"action":"hide"|"restore"|"delete","reason":"..."}`; `reason` (3-500) is required to hide or delete.
Restore clears `flagCount`. Every action writes an AuditLog row (never the text) in the same transaction.

```bash
curl -s -X POST http://localhost:5001/api/moderation/post/$POST_ID -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"action":"restore"}'
# 200 {"id":"...","status":"published","flagCount":0}
```

## Help chat (M3)

### POST /api/chat

Signed in, 20 per 10 minutes per user. Body `{"message":"..."}` (1-1000 chars). Nothing is stored.
A ticket id (`NIV-YYYY-NNNNNN`, up to 3) is answered from the database: the reporter's own, or for staff and
above anything in their scope. Someone else's ticket is listed in `unknown`, the same as a missing one.
"my complaints" / "मेरी शिकायत" lists the asker's last 5. Anything else goes to Gemini (emails and phone numbers
removed first); no key, a timeout (8 s) or an error answers `{"kind":"fallback"}`.

```bash
curl -s -X POST http://localhost:5001/api/chat -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"message":"where is NIV-2026-000001?"}'
# 200 {"kind":"ticket","tickets":[{"ticketId":"NIV-2026-000001","title":"Deep pothole","status":"assigned",
#      "expectedBy":"...","updatedAt":"...","department":"Roads"}],"unknown":[]}
# general: {"kind":"general","reply":"..."}   list: {"kind":"list","tickets":[...]}   {"kind":"fallback"}
```

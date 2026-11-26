# Nivaran v2: decisions

Source: `docs/HANDOFF.md` section 9. These win over `docs/ARCHITECTURE.md` where they differ. Change a row here
first, then the code. Dates are when the decision was recorded.

| Id | Topic | Decision | Date | Status |
|---|---|---|---|---|
| A | Login | Google plus passwordless email code only. No passwords, no verification link. | 25 Nov 2026 | decided |
| B | Accounts | One user per verified email, linked through `auth0Ids`. | 25 Nov 2026 | decided |
| C | Authorization | Role, level, scope and status from MongoDB, never from the token. | 25 Nov 2026 | decided |
| 1 | Pincode boundaries | One pilot city first. Boundaries from open GeoJSON or drawn by hand, stored in MongoDB with a 2dsphere index and a `source` field so better data can replace them. Pilot city is open (see below). | 25 Nov 2026 | decided |
| 2 | Departments | One national category list (codes: `pothole`, `garbage`, `streetlight`, `water_leak`, `drainage`, `other`; changed 26 Nov 2026, see M1-6). Each city admin maps every category to one of their city's departments; every mapping change is audit-logged. "Other" or unmapped goes to a city-admin triage queue. | 25 Nov 2026 | decided |
| 3 | Expected-by (SLA) | Calendar hours from submission, per category per city with a national default. Paused only by the on-hold flag (`slaPausedAt`). A reopened issue gets a fresh deadline. A breach notifies the dept_head, then the city_admin. | 25 Nov 2026 | decided |
| 4 | Photos | Cloudinary, signed by the server (`node:crypto`, no SDK). Max 3 per report, 5 MB each, JPEG/PNG/WebP/HEIC, EXIF stripped, public but unguessable URLs. "After" photos by staff only. Secrets only in `server/.env`. | 25 Nov 2026 | decided |
| 4a | Photos: browser side | Read GPS in the browser before stripping, only to prefill the map pin; compress in the browser to about 1600px. Agreed earlier, to verify. | 25 Nov 2026 | open |
| 5 | Languages | English and Hindi at launch; every UI string behind i18n keys. Regional languages later, Punjabi first. | 25 Nov 2026 | decided |
| 6 | Notifications | In-app and email at launch. No SMS (India DLT registration adds cost and paperwork). | 25 Nov 2026 | decided |
| 7 | Community | Signed-in, verified-email users post only in their own pincode's community. Posts go live immediately; moderation after publishing: report button, auto-hide at about 3 reports pending staff review, per-user rate limit, staff moderation queue. | 25 Nov 2026 | decided |
| O1 | Waitlist emails | HMAC only: `emailHash` = HMAC-SHA-256(`HMAC_SECRET`, lowercased email). Dedupe only; we cannot email the list later. No encryption key. | 26 Nov 2026 | decided |
| O2 | Pilot city | Phagwara, Punjab (`PB`), pincodes 144401 to 144411. A distance-from-centre fallback only for pincodes with no boundary yet. | 26 Nov 2026 | decided |
| M1-1 | Ticket ID | `NIV-YYYY-NNNNNN` (year of submission, 6-digit counter per year). Replaces the handoff's `NVN-YYMMDD-NNNNN`. | 26 Nov 2026 | decided |
| M1-2 | Issue status | `submitted, assigned, in_progress, resolved, closed, reopened, rejected`, plus an `slaPausedAt` flag (on hold is a flag, not a status). Replaces the handoff and plan M2 enum. | 26 Nov 2026 | decided |
| M1-3 | Boundary source | Pilot boundaries drawn by hand (geojson.io), stored with `boundarySource: "manual"`. Enum `aikosh, manual, none` so better data can replace them. | 26 Nov 2026 | decided |
| M1-4 | Default theme | Light. | 26 Nov 2026 | decided |
| M1-5 | i18n fallback | `t()` falls back to `en` for a key missing in the user's language. | 26 Nov 2026 | decided |
| M1-6 | Categories | `pothole, garbage, streetlight, water_leak, drainage, other`. `other` always goes to the city-admin triage queue. (Stray animals dropped.) | 26 Nov 2026 | decided |

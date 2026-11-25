# Nivaran v2: decisions

Source: `docs/HANDOFF.md` section 9. These win over `docs/ARCHITECTURE.md` where they differ. Change a row here
first, then the code. Dates are when the decision was recorded.

| Id | Topic | Decision | Date | Status |
|---|---|---|---|---|
| A | Login | Google plus passwordless email code only. No passwords, no verification link. | 25 Nov 2026 | decided |
| B | Accounts | One user per verified email, linked through `auth0Ids`. | 25 Nov 2026 | decided |
| C | Authorization | Role, level, scope and status from MongoDB, never from the token. | 25 Nov 2026 | decided |
| 1 | Pincode boundaries | One pilot city first. Boundaries from open GeoJSON or drawn by hand, stored in MongoDB with a 2dsphere index and a `source` field so better data can replace them. Pilot city is open (see below). | 25 Nov 2026 | decided |
| 2 | Departments | One national category list (Roads, Water supply, Sanitation, Streetlights, Drainage, Other). Each city admin maps every category to one of their city's departments; every mapping change is audit-logged. "Other" or unmapped goes to a city-admin triage queue. | 25 Nov 2026 | decided |
| 3 | Expected-by (SLA) | Calendar hours from submission, per category per city with a national default. Paused only by the on-hold flag (`slaPausedAt`). A reopened issue gets a fresh deadline. A breach notifies the dept_head, then the city_admin. | 25 Nov 2026 | decided |
| 4 | Photos | Cloudinary, signed by the server (`node:crypto`, no SDK). Max 3 per report, 5 MB each, JPEG/PNG/WebP/HEIC, EXIF stripped, public but unguessable URLs. "After" photos by staff only. Secrets only in `server/.env`. | 25 Nov 2026 | decided |
| 4a | Photos: browser side | Read GPS in the browser before stripping, only to prefill the map pin; compress in the browser to about 1600px. Agreed earlier, to verify. | 25 Nov 2026 | open |
| 5 | Languages | English and Hindi at launch; every UI string behind i18n keys. Regional languages later, Punjabi first. | 25 Nov 2026 | decided |
| 6 | Notifications | In-app and email at launch. No SMS (India DLT registration adds cost and paperwork). | 25 Nov 2026 | decided |
| 7 | Community | Signed-in, verified-email users post only in their own pincode's community. Posts go live immediately; moderation after publishing: report button, auto-hide at about 3 reports pending staff review, per-user rate limit, staff moderation queue. | 25 Nov 2026 | decided |
| O1 | Waitlist emails | HMAC only (dedupe, cannot email later) or encrypted emails (can notify). Choose before building. | 25 Nov 2026 | open |
| O2 | Pilot city | Decides which pincode boundaries load first. A distance-from-centre fallback only for pincodes with no boundary yet. | 25 Nov 2026 | open |

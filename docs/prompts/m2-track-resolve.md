# M2: Track and resolve

Exit criteria (from `docs/PLAN.md`): a resident tracks their issue with a timeline; staff work an SLA-sorted queue,
move issues through the state machine (resolved needs an after photo), the resident confirms or reopens; the SLA
job marks at risk and breached and escalates; in-app notifications; public stats. Tests pass.

Branch: `feat/m2-track-resolve`. Common rules: `docs/prompts/m1-core-loop.md` ("Common rules"). Flow diagrams:
`docs/ARCHITECTURE.md` 11.5, 12.3, 12.4.

## Batch D: backend

0. Flow first: issue state machine, "staff updates status -> resident notified" sequence, SLA job flow.
1. `utils/issueStateMachine.js` (pure) with a test for every allowed and every forbidden transition.
2. `GET /api/issues/mine` (cursor, max 50). `GET /api/issues/:ticketId` adds the timeline (role, never email).
3. `GET /api/staff/issues` (`issue:read_scope`): department for staff and dept_head, city (with triage) for
   city_admin. Filters `status`, `sla`, `category`, `queue`. Sorted by `expectedBy`, then `createdAt`. Cursor.
4. `PATCH /api/issues/:ticketId/status` and `.../assign`, optimistic concurrency (`version`, 409 CONFLICT).
5. Reporter: `POST .../confirm`, `POST .../reopen {note}`.
6. dept_head: `POST .../hold {reason}`, `POST .../resume`.
7. SLA job (`jobs/slaJob.js`): at risk, breached, escalation, auto-close after 7 days. Idempotent.
8. `Notification` model (TTL 90 days), `GET /api/notifications`, `POST /api/notifications/read`.
9. `GET /api/stats` (public, cached 5 min).
Indexes: `npm run migrate:m2-indexes -w server` (dry run), `-- --apply` to write.

## Batch E: frontend

1. Issues page: "My issues" list (cursor, load more) with `StatusBadge`, `SlaBadge`, ticket ID.
2. Issue detail page: `StatusTimeline` from the timeline, after photos, Confirm and Reopen (note) for the reporter.
3. Staff queue page (`issue:read_scope`): filters, SLA sort, status actions with a note and after-photo upload,
   assign for triage, hold and resume for dept_head; a 409 reloads the row and says so.
4. Notifications: bell with unread count in the top bar, list, mark read. Every string in en and hi.
5. Landing page stats from `GET /api/stats` (`StatCard`, `@number-flow/react`).
6. Playwright: track, staff resolve, confirm; fixtures updated from `docs/API.md`.

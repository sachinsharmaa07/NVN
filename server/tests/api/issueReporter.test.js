// POST .../confirm and .../reopen (M2 step 5, reporter only); POST .../hold and .../resume (step 6, dept_head).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, makeIssue, seedIssueWorld, HOUR } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { Issue } = await import("../../src/models/Issue.js");
const { AuditLog } = await import("../../src/models/AuditLog.js");
const { Notification } = await import("../../src/models/Notification.js");
const { runSlaTick } = await import("../../src/jobs/slaJob.js");

useTestDb();
useFakeAuth0();
const app = createApp();

const NOW = new Date("2026-11-26T06:30:00Z");
let w;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  w = await seedIssueWorld();
});
afterEach(() => vi.useRealTimers());

const post = (user, issue, path, body) =>
  as(app, user).post(`/api/issues/${issue.ticketId}/${path}`).send(body);
const code = (res) => res.body.error?.code;
const resolved = () =>
  makeIssue(w, {
    status: "resolved",
    resolvedAt: new Date(NOW - HOUR),
    slaState: "breached",
    breachNotifiedDeptHeadAt: new Date(NOW - 2 * HOUR),
  });

describe("POST /api/issues/:ticketId/confirm", () => {
  it("closes a resolved issue for its reporter, with history and audit", async () => {
    const issue = await resolved();
    const res = await post(w.reporter, issue, "confirm", { version: 0 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "closed", version: 1 });
    expect(res.body.timeline.at(-1)).toMatchObject({ status: "closed", role: "citizen" });
    expect(await AuditLog.countDocuments({ action: "issue.status_change" })).toBe(1);
    expect(await Notification.countDocuments()).toBe(0); // nobody to tell: the reporter did it
  });

  it("is the same 404 for anyone but the reporter, even staff in scope", async () => {
    const issue = await resolved();
    const other = await post(w.citizen, issue, "confirm", { version: 0 });
    const staff = await post(w.staff, issue, "confirm", { version: 0 });
    expect(other.status).toBe(404);
    expect(staff.body).toEqual(other.body);
  });

  it("is 400 INVALID_TRANSITION unless resolved, 409 for a stale version", async () => {
    const open = await makeIssue(w, { status: "in_progress" });
    expect(code(await post(w.reporter, open, "confirm", { version: 0 }))).toBe(
      "INVALID_TRANSITION",
    );
    const issue = await resolved();
    expect((await post(w.reporter, issue, "confirm", { version: 1 })).status).toBe(409);
  });

  it("is 403 for a role without issue:read_own", async () => {
    const issue = await resolved();
    expect((await post(w.state, issue, "confirm", { version: 0 })).status).toBe(403);
  });
});

describe("POST /api/issues/:ticketId/reopen", () => {
  it("reopens with a note and a fresh deadline from the SLA policy, SLA record cleared", async () => {
    const issue = await resolved();
    const res = await post(w.reporter, issue, "reopen", { note: "Still broken", version: 0 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "reopened",
      slaState: "on_track",
      expectedBy: new Date(NOW.getTime() + 168 * HOUR).toISOString(),
    });
    expect(res.body.timeline.at(-1)).toMatchObject({ status: "reopened", note: "Still broken" });
    const stored = await Issue.findById(issue._id).lean();
    expect(stored.resolvedAt).toBeNull();
    expect(stored.breachNotifiedDeptHeadAt).toBeNull();
    expect(stored.atRiskAt.toISOString()).toBe(new Date(NOW.getTime() + 126 * HOUR).toISOString());
  });

  it("needs a note; 404 for someone else; 400 unless resolved; 409 when stale", async () => {
    const issue = await resolved();
    expect(code(await post(w.reporter, issue, "reopen", { version: 0 }))).toBe("VALIDATION_ERROR");
    expect((await post(w.citizen, issue, "reopen", { note: "Nope", version: 0 })).status).toBe(404);
    expect((await post(w.reporter, issue, "reopen", { note: "Nope", version: 2 })).status).toBe(
      409,
    );
    const closed = await makeIssue(w, { status: "closed" });
    expect(code(await post(w.reporter, closed, "reopen", { note: "Again", version: 0 }))).toBe(
      "INVALID_TRANSITION",
    );
  });
});

describe("POST /api/issues/:ticketId/hold and /resume", () => {
  it("hold pauses the SLA; resume shifts expectedBy and atRiskAt by the time held", async () => {
    const issue = await makeIssue(w, { status: "in_progress" });
    const held = await post(w.head, issue, "hold", { reason: "Waiting for parts", version: 0 });
    expect(held.status).toBe(200);
    expect(held.body).toMatchObject({ onHold: true, holdReason: "Waiting for parts", version: 1 });
    expect(await Notification.findOne({ type: "on_hold" }).lean()).toMatchObject({
      userId: w.reporter._id,
    });

    // While on hold, status changes wait.
    const blocked = await as(app, w.staff)
      .patch(`/api/issues/${issue.ticketId}/status`)
      .send({ status: "resolved", version: 1 });
    expect(code(blocked)).toBe("INVALID_TRANSITION");

    vi.setSystemTime(new Date(NOW.getTime() + 5 * HOUR));
    const resumed = await post(w.head, issue, "resume", { version: 1 });
    expect(resumed.status).toBe(200);
    expect(resumed.body).toMatchObject({ onHold: false, holdReason: null, version: 2 });
    const stored = await Issue.findById(issue._id).lean();
    expect(stored.expectedBy - issue.expectedBy).toBe(5 * HOUR);
    expect(stored.atRiskAt - issue.atRiskAt).toBe(5 * HOUR);
    expect(await AuditLog.countDocuments({ action: "issue.hold" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "issue.resume" })).toBe(1);
  });

  it("resume shifts respondBy too, so the respond-by alert doesn't fire for time spent on hold", async () => {
    const respondBy = new Date(NOW.getTime() + 24 * HOUR);
    const issue = await makeIssue(w, { respondBy });
    expect(
      (await post(w.head, issue, "hold", { reason: "Waiting for parts", version: 0 })).status,
    ).toBe(200);
    vi.setSystemTime(new Date(NOW.getTime() + 5 * HOUR));
    expect((await post(w.head, issue, "resume", { version: 1 })).status).toBe(200);

    const stored = await Issue.findById(issue._id).lean();
    expect(stored.respondBy - respondBy).toBe(5 * HOUR);
    // At the old deadline the clock has only run 19 of its 24 hours: no alert yet.
    expect(await runSlaTick(new Date(respondBy.getTime() + HOUR))).toMatchObject({
      respondOverdue: 0,
    });
    expect(await Notification.countDocuments({ type: "sla_respond_overdue" })).toBe(0);
  });

  it("is 403 for staff and city_admin (dept_head only), 404 for another department's head", async () => {
    const issue = await makeIssue(w);
    const body = { reason: "Waiting for parts", version: 0 };
    expect((await post(w.staff, issue, "hold", body)).status).toBe(403);
    expect((await post(w.admin, issue, "hold", body)).status).toBe(403);
    expect((await post(w.citizen, issue, "hold", body)).status).toBe(403);
    const water = await makeIssue(w, { departmentId: w.water._id });
    expect((await post(w.head, water, "hold", body)).status).toBe(404);
  });

  it("is 400 INVALID_TRANSITION when already held, not held, or closed; 409 when stale", async () => {
    const issue = await makeIssue(w);
    expect(code(await post(w.head, issue, "resume", { version: 0 }))).toBe("INVALID_TRANSITION");
    const held = await makeIssue(w, { slaPausedAt: NOW, holdReason: "Parts" });
    expect(code(await post(w.head, held, "hold", { reason: "More", version: 0 }))).toBe(
      "INVALID_TRANSITION",
    );
    const closed = await makeIssue(w, { status: "closed" });
    expect(code(await post(w.head, closed, "hold", { reason: "Parts", version: 0 }))).toBe(
      "INVALID_TRANSITION",
    );
    expect((await post(w.head, issue, "hold", { reason: "Parts", version: 4 })).status).toBe(409);
  });
});

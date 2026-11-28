// SLA job (M2 step 7), called directly with a chosen time. Real MongoDB, real transactions.
import { describe, it, expect, beforeEach } from "vitest";
import { useTestDb, seedUser } from "../helpers/testDb.js";
import { makeIssue, seedIssueWorld, HOUR } from "../helpers/issueWorld.js";

const { runSlaTick, startSlaJob } = await import("../../src/jobs/slaJob.js");
const { Issue } = await import("../../src/models/Issue.js");
const { AuditLog } = await import("../../src/models/AuditLog.js");
const { Notification } = await import("../../src/models/Notification.js");
const { User } = await import("../../src/models/User.js");

useTestDb();

const T0 = new Date("2026-11-20T00:00:00Z");
const at = (h) => new Date(T0.getTime() + h * HOUR);
let w;
beforeEach(async () => {
  w = await seedIssueWorld();
});

// makeIssue(createdAt T0) is due at 168 h, at risk from 126 h.
const issueAtT0 = (over) => makeIssue(w, { createdAt: T0, ...over });
const stateOf = async (issue) => (await Issue.findById(issue._id).lean()).slaState;
const notes = (filter) => Notification.find(filter).lean();

describe("runSlaTick", () => {
  it("marks at_risk at 75% and breached past due, only for open, unpaused issues", async () => {
    const open = await issueAtT0();
    const paused = await issueAtT0({ slaPausedAt: at(1) });
    const done = await issueAtT0({ status: "resolved", resolvedAt: at(200) });

    expect(await runSlaTick(at(125))).toMatchObject({ atRisk: 0, breached: 0 });
    expect(await runSlaTick(at(126))).toMatchObject({ atRisk: 1, breached: 0 });
    expect(await stateOf(open)).toBe("at_risk");
    expect(await runSlaTick(at(168))).toMatchObject({ breached: 1 });
    expect(await stateOf(open)).toBe("breached");
    expect(await stateOf(paused)).toBe("on_track");
    expect(await stateOf(done)).toBe("on_track");
  });

  it("notifies the dept_head on breach, the city_admin 24 h later, each exactly once", async () => {
    const issue = await issueAtT0();
    await runSlaTick(at(168));
    await runSlaTick(at(169)); // a rerun sends nothing new
    let sent = await notes({});
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      userId: w.head._id,
      type: "sla_breached",
      ticketId: issue.ticketId,
    });

    await runSlaTick(at(168 + 23));
    expect(await notes({ type: "sla_escalated" })).toHaveLength(0);
    await runSlaTick(at(168 + 24));
    await runSlaTick(at(168 + 25));
    sent = await notes({ type: "sla_escalated" });
    expect(sent).toHaveLength(1);
    expect(sent[0].userId).toEqual(w.admin._id); // the issue's city admin, not the other city's
  });

  it("a breached triage issue goes straight to the city_admin, once, then the state 48 h later", async () => {
    await issueAtT0({ departmentId: null, queue: "triage", category: "other" });
    await runSlaTick(at(168));
    await runSlaTick(at(168 + 48));
    const sent = await notes({});
    expect(sent.map((n) => [String(n.userId), n.type])).toEqual([
      [String(w.admin._id), "sla_breached"],
      [String(w.state._id), "sla_escalated_state"],
    ]);
  });

  it("escalates to the state officers of the city's state 48 h after the city_admin, once", async () => {
    const elsewhere = await seedUser("state_officer", { stateCode: "MH" });
    const issue = await issueAtT0();
    await runSlaTick(at(168)); // dept_head
    await runSlaTick(at(168 + 24)); // city_admin
    await runSlaTick(at(168 + 24 + 47));
    expect(await notes({ type: "sla_escalated_state" })).toHaveLength(0);
    await runSlaTick(at(168 + 24 + 48));
    await runSlaTick(at(168 + 24 + 49)); // a rerun sends nothing new
    const sent = await notes({ type: "sla_escalated_state" });
    expect(sent.map((n) => String(n.userId))).toEqual([String(w.state._id)]);
    expect(sent.some((n) => String(n.userId) === String(elsewhere._id))).toBe(false);
    const stored = await Issue.findById(issue._id).lean();
    expect(stored.breachNotifiedStateOfficerAt).toEqual(at(168 + 24 + 48));
  });

  it("claims level 3 once even when the state has no officer", async () => {
    // Raw write: no active officer left in PB (the model guards status changes for app code).
    await User.collection.updateMany({ role: "state_officer" }, { $set: { status: "suspended" } });
    const issue = await issueAtT0();
    await runSlaTick(at(168));
    await runSlaTick(at(168 + 24));
    expect((await runSlaTick(at(168 + 72))).notified).toBe(0);
    expect((await Issue.findById(issue._id).lean()).breachNotifiedStateOfficerAt).toEqual(
      at(168 + 72),
    );
  });

  it("two ticks at once still notify once", async () => {
    await issueAtT0({ slaState: "breached" });
    await Promise.all([runSlaTick(at(170)), runSlaTick(at(170))]);
    expect(await notes({ type: "sla_breached" })).toHaveLength(1);
  });

  it("auto-closes resolved issues after 7 days: history by system, audit, reporter told", async () => {
    const issue = await issueAtT0({ status: "resolved", resolvedAt: at(10) });
    expect((await runSlaTick(at(10 + 167))).autoClosed).toBe(0);
    expect((await runSlaTick(at(10 + 168))).autoClosed).toBe(1);
    expect((await runSlaTick(at(10 + 169))).autoClosed).toBe(0);
    const stored = await Issue.findById(issue._id).lean();
    expect(stored.status).toBe("closed");
    expect(stored.closureType).toBe("auto_closed");
    expect(stored.__v).toBe(1);
    expect(stored.statusHistory.at(-1)).toMatchObject({
      status: "closed",
      by: null,
      role: "system",
    });
    expect(await AuditLog.findOne({ action: "issue.status_change" }).lean()).toMatchObject({
      actorType: "system",
      actorLabel: "sla-job",
      after: { ticketId: issue.ticketId, status: "closed" },
    });
    expect(await notes({ userId: w.reporter._id, status: "closed" })).toHaveLength(1);
  });

  it("never starts a timer in tests", () => {
    expect(startSlaJob(1000)).toBeNull();
  });
});

describe("respond-by", () => {
  it("tells the dept_head once when a submitted issue isn't assigned in time", async () => {
    const late = await issueAtT0({ respondBy: at(24) });
    await issueAtT0({ respondBy: at(24), status: "assigned" }); // picked up in time: no note
    await issueAtT0(); // an M1 issue without respondBy: skipped

    expect(await runSlaTick(at(23))).toMatchObject({ respondOverdue: 0 });
    expect(await runSlaTick(at(24))).toMatchObject({ respondOverdue: 1 });
    expect(await runSlaTick(at(25))).toMatchObject({ respondOverdue: 0 }); // once per deadline
    expect(await notes({ type: "sla_respond_overdue" })).toEqual([
      expect.objectContaining({ userId: w.head._id, ticketId: late.ticketId }),
    ]);
  });

  it("tells the city_admin for a triage issue", async () => {
    await issueAtT0({ respondBy: at(24), departmentId: null, queue: "triage" });
    await runSlaTick(at(24));
    const [note] = await notes({ type: "sla_respond_overdue" });
    expect(note.userId).toEqual(w.admin._id);
  });
});

// SLA job (M2 step 7), called directly with a chosen time. Real MongoDB, real transactions.
import { describe, it, expect, beforeEach } from "vitest";
import { useTestDb } from "../helpers/testDb.js";
import { makeIssue, seedIssueWorld, HOUR } from "../helpers/issueWorld.js";

const { runSlaTick, startSlaJob } = await import("../../src/jobs/slaJob.js");
const { Issue } = await import("../../src/models/Issue.js");
const { AuditLog } = await import("../../src/models/AuditLog.js");
const { Notification } = await import("../../src/models/Notification.js");

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

  it("a breached triage issue goes straight to the city_admin, once", async () => {
    await issueAtT0({ departmentId: null, queue: "triage", category: "other" });
    await runSlaTick(at(168));
    await runSlaTick(at(168 + 48));
    const sent = await notes({});
    expect(sent.map((n) => [String(n.userId), n.type])).toEqual([
      [String(w.admin._id), "sla_breached"],
    ]);
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

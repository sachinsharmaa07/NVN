// SLA job tick (the timer is jobs/slaJob.js): mark at_risk and breached, flag issues not assigned by respondBy,
// notify the dept_head on a breach, the city_admin 24 h later and the state_officer 48 h after that, auto-close
// resolved issues after 7 days,
// then send pending notification emails. Idempotent: every write is
// guarded by the field it sets, so a rerun or an overlapping tick sends nothing twice.
// One server instance runs it (ADR 0001); a second would only repeat no-op queries.
import { logger } from "../config/logger.js";
import { City } from "../models/City.js";
import { Issue } from "../models/Issue.js";
import { User } from "../models/User.js";
import { clock } from "../utils/clock.js";
import { OPEN_STATUSES } from "../utils/issueStateMachine.js";
import { inTransaction, trusted } from "./adminUserSupport.js";
import { record } from "./auditService.js";
import { notify } from "./notificationService.js";
import { drainEmails } from "./emailOutboxService.js";

const HOUR = 3600_000;
export const ESCALATE_AFTER_MS = 24 * HOUR;
export const STATE_ESCALATE_AFTER_MS = 48 * HOUR; // after the city_admin step
export const AUTO_CLOSE_AFTER_MS = 7 * 24 * HOUR;
const BATCH = 200; // per step per tick; the rest waits for the next tick
const log = logger.child({ job: "sla" });

const open = () => ({ status: trusted({ $in: OPEN_STATUSES }), slaPausedAt: null });
const activeIds = (filter) => User.find({ ...filter, status: "active" }).distinct("_id");

/** Claims `field` on one issue (null -> now) and notifies `recipients(issue)` in the same transaction. */
async function claimAndNotify(issue, set, type, recipients) {
  return inTransaction(async (session) => {
    const field = Object.keys(set)[0];
    const claimed = await Issue.findOneAndUpdate(
      { _id: issue._id, [field]: null },
      { $set: set },
      { session, returnDocument: "after" },
    ).lean();
    if (!claimed) return 0; // someone else got it
    const ids = await recipients(claimed);
    await notify(ids, type, claimed, { session });
    return ids.length;
  });
}

async function escalate(now) {
  let sent = 0;
  const breachedOpen = { ...open(), slaState: "breached" };
  const first = await Issue.find({ ...breachedOpen, breachNotifiedDeptHeadAt: null })
    .limit(BATCH)
    .lean();
  for (const issue of first) {
    // A triage issue has no dept_head: its city_admin hears at once, and that is the last step.
    const set = issue.departmentId
      ? { breachNotifiedDeptHeadAt: now }
      : { breachNotifiedDeptHeadAt: now, breachNotifiedCityAdminAt: now };
    const to = (i) =>
      i.departmentId
        ? activeIds({ role: "dept_head", departmentId: i.departmentId })
        : activeIds({ role: "city_admin", cityId: i.cityId });
    sent += await claimAndNotify(issue, set, "sla_breached", to);
  }
  const second = await Issue.find({
    ...breachedOpen,
    breachNotifiedDeptHeadAt: trusted({ $lte: new Date(now - ESCALATE_AFTER_MS) }),
    breachNotifiedCityAdminAt: null,
  })
    .limit(BATCH)
    .lean();
  for (const issue of second) {
    const to = (i) => activeIds({ role: "city_admin", cityId: i.cityId });
    sent += await claimAndNotify(issue, { breachNotifiedCityAdminAt: now }, "sla_escalated", to);
  }
  // Level 3. A state with no officer still gets the claim, like the steps above, so it isn't retried every tick.
  const third = await Issue.find({
    ...breachedOpen,
    breachNotifiedCityAdminAt: trusted({ $lte: new Date(now - STATE_ESCALATE_AFTER_MS) }),
    breachNotifiedStateOfficerAt: null,
  })
    .limit(BATCH)
    .lean();
  for (const issue of third) {
    const to = async (i) => {
      const city = await City.findById(i.cityId, "stateCode").lean();
      return city ? activeIds({ role: "state_officer", stateCode: city.stateCode }) : [];
    };
    sent += await claimAndNotify(
      issue,
      { breachNotifiedStateOfficerAt: now },
      "sla_escalated_state",
      to,
    );
  }
  return sent;
}

// Decision 3, respond-by: a submitted or reopened issue nobody has assigned in time. The dept_head hears
// (the city_admin for a triage issue), once per deadline; reopening sets a new respondBy and clears the flag.
async function respondOverdue(now) {
  const late = await Issue.find({
    status: trusted({ $in: ["submitted", "reopened"] }),
    slaPausedAt: null,
    respondBy: trusted({ $lte: now }),
    respondNotifiedAt: null,
  })
    .limit(BATCH)
    .lean();
  let sent = 0;
  for (const issue of late) {
    const to = (i) =>
      i.departmentId
        ? activeIds({ role: "dept_head", departmentId: i.departmentId })
        : activeIds({ role: "city_admin", cityId: i.cityId });
    sent += await claimAndNotify(issue, { respondNotifiedAt: now }, "sla_respond_overdue", to);
  }
  return sent;
}

async function autoClose(now) {
  const due = await Issue.find({
    status: "resolved",
    resolvedAt: trusted({ $lte: new Date(now - AUTO_CLOSE_AFTER_MS) }),
  })
    .limit(BATCH)
    .lean();
  let closed = 0;
  for (const issue of due) {
    closed += await inTransaction(async (session) => {
      const after = await Issue.findOneAndUpdate(
        { _id: issue._id, status: "resolved", __v: issue.__v },
        {
          $set: { status: "closed", closureType: "auto_closed" },
          $inc: { __v: 1 },
          $push: { statusHistory: { status: "closed", at: now, by: null, role: "system" } },
        },
        { session, returnDocument: "after", runValidators: true },
      ).lean();
      if (!after) return 0; // the reporter acted first; their write wins
      await record(
        {
          actorType: "system",
          actorLabel: "sla-job",
          action: "issue.status_change",
          targetId: issue._id,
          cityId: issue.cityId,
          before: { ticketId: issue.ticketId, status: "resolved" },
          after: { ticketId: issue.ticketId, status: "closed" },
        },
        { session },
      );
      await notify([issue.reporterId], "status_changed", after, { session });
      return 1;
    });
  }
  return closed;
}

/** One tick. Exported so tests and scripts can call it directly with a chosen `now`. */
export async function runSlaTick(now = clock.now()) {
  const atRisk = await Issue.updateMany(
    { ...open(), slaState: "on_track", atRiskAt: trusted({ $lte: now }) },
    { $set: { slaState: "at_risk" } },
  );
  const breached = await Issue.updateMany(
    {
      ...open(),
      slaState: trusted({ $in: ["on_track", "at_risk"] }),
      expectedBy: trusted({ $lte: now }),
    },
    { $set: { slaState: "breached" } },
  );
  const result = {
    atRisk: atRisk.modifiedCount,
    breached: breached.modifiedCount,
    notified: await escalate(now),
    respondOverdue: await respondOverdue(now),
    autoClosed: await autoClose(now),
    emailed: (await drainEmails({ now })).sent,
  };
  log.info({ event: "sla.tick", ...result }, "SLA tick");
  return result;
}

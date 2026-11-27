// Every issue write after submit (hold and resume are in issueHoldService). One path: find in scope (404), check the version (409)
// and the state machine (400/403), then ONE transaction: conditional update on { _id, __v }, AuditLog row,
// reporter notification. Services get plain values, never req.
import { Issue } from "../models/Issue.js";
import { Department } from "../models/Department.js";
import { AppError } from "../utils/AppError.js";
import { clock } from "../utils/clock.js";
import { atRiskAt, expectedBy } from "../utils/expectedBy.js";
import { checkTransition, needsNote } from "../utils/issueStateMachine.js";
import { forbidden, inTransaction, notFound } from "./adminUserSupport.js";
import { record } from "./auditService.js";
import { issueScope } from "./issueQueryService.js";
import { drainSoon } from "./emailOutboxService.js";
import { detail } from "./issueView.js";
import { notify } from "./notificationService.js";
import { verifyPhotos } from "./photoCheckService.js";
import { slaHours } from "./issueService.js";

const conflict = () =>
  new AppError("CONFLICT", 409, "Someone else changed this issue. Reload it and try again.");
export const invalid = (message) => new AppError("INVALID_TRANSITION", 400, message);
const validation = (message) => new AppError("VALIDATION_ERROR", 400, message);

/** The issue if `filter` (ticket + scope) matches and the client saw its latest version. */
export async function load(filter, version) {
  const issue = await Issue.findOne(filter).lean();
  if (!issue) throw notFound();
  if ((issue.__v ?? 0) !== version) throw conflict();
  return issue;
}

/** Throws the right error unless `actorKind` may move the issue to `to`. */
function allow(issue, to, actorKind) {
  const verdict = checkTransition(issue.status, to, actorKind);
  if (verdict === "invalid") throw invalid(`An issue that is ${issue.status} can't become ${to}.`);
  if (verdict === "forbidden") throw forbidden();
  if (issue.slaPausedAt) throw invalid("This issue is on hold. Resume it first.");
}

/**
 * The single write. `change`: { set, history?: { status, note? }, audit: { action, before, after, reason? },
 * notifyType? }. A concurrent writer bumped __v first: no match, 409.
 */
export async function commit(actor, issue, version, change, ctx) {
  const now = clock.now();
  const update = { $set: change.set, $inc: { __v: 1 } };
  if (change.history) {
    update.$push = {
      statusHistory: { ...change.history, at: now, by: actor.id, role: actor.role },
    };
  }
  const saved = await inTransaction(async (session) => {
    const after = await Issue.findOneAndUpdate({ _id: issue._id, __v: version }, update, {
      returnDocument: "after",
      session,
      runValidators: true,
    }).lean();
    if (!after) throw conflict();
    await record(
      {
        actorType: "user",
        actorId: actor.id,
        actorRole: actor.role,
        targetId: issue._id,
        cityId: issue.cityId,
        ip: ctx.ip,
        requestId: ctx.requestId,
        ...change.audit,
        before: { ticketId: issue.ticketId, ...change.audit.before },
        after: { ticketId: issue.ticketId, ...change.audit.after },
      },
      { session },
    );
    const toReporter = change.notifyType && String(issue.reporterId) !== String(actor.id);
    if (toReporter) await notify([issue.reporterId], change.notifyType, after, { session });
    return after;
  });
  if (change.notifyType) drainSoon(); // after the commit: mail never holds the transaction open
  return detail(saved);
}

/** PATCH /api/issues/:ticketId/status (staff, dept_head, city_admin). */
export async function changeStatus(actor, ticketId, input, ctx = {}) {
  const { status: to, note, afterPhotoPublicIds, version } = input;
  const issue = await load({ ticketId, ...(await issueScope(actor)) }, version);
  allow(issue, to, actor.role);
  if (to === "assigned" && !issue.departmentId) {
    throw invalid("This issue is in triage. Assign it to a department instead.");
  }
  if (needsNote(to) && !note) throw validation("Add a note saying why.");
  if (afterPhotoPublicIds?.length && to !== "resolved") {
    throw validation("After photos go only with resolved.");
  }
  if (to === "resolved" && !afterPhotoPublicIds?.length) {
    throw validation("Add at least one after photo.");
  }
  const set = { status: to };
  if (to === "resolved") {
    set.afterPhotos = await verifyPhotos(afterPhotoPublicIds);
    set.resolvedAt = clock.now();
  }
  return commit(
    actor,
    issue,
    version,
    {
      set,
      history: { status: to, note },
      audit: {
        action: "issue.status_change",
        before: { status: issue.status },
        after: { status: to },
        reason: note,
      },
      notifyType: "status_changed",
    },
    ctx,
  );
}

/** PATCH /api/issues/:ticketId/assign: a triage issue goes to one of its city's departments. */
export async function assignIssue(actor, ticketId, { departmentId, version }, ctx = {}) {
  const issue = await load({ ticketId, ...(await issueScope(actor, { triage: true })) }, version);
  if (issue.queue !== "triage") throw invalid("This issue already has a department.");
  allow(issue, "assigned", actor.role);
  const dept = await Department.findOne({ _id: departmentId, cityId: issue.cityId }, "_id").lean();
  if (!dept) throw notFound();
  const set = { departmentId: dept._id, queue: "department", status: "assigned" };
  return commit(
    actor,
    issue,
    version,
    {
      set,
      history: { status: "assigned" },
      audit: {
        action: "issue.assign",
        before: { status: issue.status, queue: "triage" },
        after: set,
      },
      notifyType: "status_changed",
    },
    ctx,
  );
}

/** POST .../confirm (resolved -> closed) and .../reopen (resolved -> reopened): the reporter only. */
export async function reporterAction(actor, ticketId, to, { note, version }, ctx = {}) {
  const issue = await load({ ticketId, reporterId: actor.id }, version);
  allow(issue, to, "reporter");
  const set = { status: to };
  if (to === "reopened") {
    // Decision 3: a reopened issue gets a fresh deadline and a clean SLA record.
    const now = clock.now();
    const hours = await slaHours(issue.cityId, issue.category);
    const due = expectedBy(now, hours.resolveHours);
    Object.assign(set, {
      expectedBy: due,
      atRiskAt: atRiskAt(now, due),
      respondBy: expectedBy(now, hours.respondHours),
      respondNotifiedAt: null,
      slaState: "on_track",
      resolvedAt: null,
      breachNotifiedDeptHeadAt: null,
      breachNotifiedCityAdminAt: null,
    });
  }
  return commit(
    actor,
    issue,
    version,
    {
      set,
      history: { status: to, note },
      audit: {
        action: "issue.status_change",
        before: { status: issue.status },
        after: { status: to },
        reason: note,
      },
    },
    ctx,
  );
}

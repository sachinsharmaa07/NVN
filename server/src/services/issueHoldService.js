// On hold (M2 step 6): the slaPausedAt flag, not a status. dept_head of the issue's department only.
import { clock } from "../utils/clock.js";
import { OPEN_STATUSES } from "../utils/issueStateMachine.js";
import { forbidden } from "./adminUserSupport.js";
import { issueScope } from "./issueQueryService.js";
import { commit, invalid, load } from "./issueWorkflowService.js";

/** POST .../hold {reason} and .../resume: dept_head of the issue's department only. */
export async function setHold(actor, ticketId, hold, { reason, version }, ctx = {}) {
  if (actor.role !== "dept_head") throw forbidden();
  const issue = await load({ ticketId, ...(await issueScope(actor)) }, version);
  if (!OPEN_STATUSES.includes(issue.status))
    throw invalid(`An issue that is ${issue.status} can't be held.`);
  if (hold === Boolean(issue.slaPausedAt)) {
    throw invalid(hold ? "This issue is already on hold." : "This issue isn't on hold.");
  }
  const now = clock.now();
  let set;
  if (hold) {
    set = { slaPausedAt: now, holdReason: reason };
  } else {
    // The clock didn't run while on hold: push both deadlines back by the time held.
    const pausedMs = now.getTime() - issue.slaPausedAt.getTime();
    const shift = (d) => (d ? new Date(d.getTime() + pausedMs) : d);
    set = {
      slaPausedAt: null,
      holdReason: null,
      expectedBy: shift(issue.expectedBy),
      atRiskAt: shift(issue.atRiskAt),
    };
  }
  return commit(
    actor,
    issue,
    version,
    {
      set,
      audit: {
        action: hold ? "issue.hold" : "issue.resume",
        before: { slaPausedAt: issue.slaPausedAt, expectedBy: issue.expectedBy },
        after: { slaPausedAt: set.slaPausedAt, expectedBy: set.expectedBy ?? issue.expectedBy },
        reason: hold ? reason : undefined,
      },
      notifyType: hold ? "on_hold" : "resumed",
    },
    ctx,
  );
}

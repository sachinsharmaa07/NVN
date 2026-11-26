// Issue lists: the reporter's own (M2 step 2) and the staff queue (step 3). Scope is in the query.
import { Issue } from "../models/Issue.js";
import { City } from "../models/City.js";
import { decodeCursor, decodeQueueCursor, encodeQueueCursor, pageOf } from "../utils/cursor.js";
import { OPEN_STATUSES } from "../utils/issueStateMachine.js";
import { forbidden, trusted } from "./adminUserSupport.js";
import { staffItem, summary } from "./issueView.js";

// trusted() lets our own operators through the global sanitizeFilter (adminUserList does the same).
const olderThan = ({ createdAt, _id }) => ({
  $or: [{ createdAt: trusted({ $lt: createdAt }) }, { createdAt, _id: trusted({ $lt: _id }) }],
});

/** GET /api/issues/mine: newest first, index { reporterId, createdAt }. */
export async function listMine(actor, { cursor, limit }) {
  const filter = { reporterId: actor.id };
  if (cursor) Object.assign(filter, olderThan(decodeCursor(cursor)));
  const rows = await Issue.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const { items, nextCursor } = pageOf(rows, limit);
  return { items: items.map(summary), nextCursor };
}

/**
 * The issues a staff-side actor may see or work on, as a Mongo filter (scope inside the query).
 * staff and dept_head: their department. city_admin: their city, triage included.
 * state_officer: their state's cities (read only). super_admin: all.
 * `triage: true` (queue list and assign only, decision M2-10): a dept_head also gets their city's triage.
 */
export async function issueScope(actor, { triage = false } = {}) {
  if (["staff", "dept_head"].includes(actor.role) && actor.departmentId) {
    if (triage && actor.role === "dept_head" && actor.cityId) {
      return {
        $or: [{ departmentId: actor.departmentId }, { cityId: actor.cityId, queue: "triage" }],
      };
    }
    return { departmentId: actor.departmentId };
  }
  if (actor.role === "city_admin" && actor.cityId) return { cityId: actor.cityId };
  if (actor.role === "state_officer" && actor.stateCode) {
    const cityIds = await City.find({ stateCode: actor.stateCode }).distinct("_id");
    return { cityId: trusted({ $in: cityIds }) };
  }
  if (actor.role === "super_admin") return {};
  throw forbidden();
}

const laterInQueue = ({ expectedBy, createdAt, _id }) => ({
  $or: [
    { expectedBy: trusted({ $gt: expectedBy }) },
    { expectedBy, createdAt: trusted({ $gt: createdAt }) },
    { expectedBy, createdAt, _id: trusted({ $gt: _id }) },
  ],
});

/** GET /api/staff/issues: soonest due first. Without `status`, only open issues. */
export async function listStaffQueue(actor, { cursor, limit, status, sla, category, queue }) {
  const filter = { ...(await issueScope(actor, { triage: true })) };
  filter.status = status ?? trusted({ $in: OPEN_STATUSES });
  if (sla) filter.slaState = sla;
  if (category) filter.category = category;
  if (queue) filter.queue = queue;
  // $and: the scope may hold its own $or, which the cursor's $or must not overwrite.
  if (cursor) filter.$and = [laterInQueue(decodeQueueCursor(cursor))];
  const rows = await Issue.find(filter)
    .sort({ expectedBy: 1, createdAt: 1, _id: 1 })
    .limit(limit + 1)
    .lean();
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? encodeQueueCursor(items[items.length - 1]) : null;
  return { items: items.map(staffItem), nextCursor };
}

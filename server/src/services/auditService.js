// The only door to the AuditLog: record() and listAudit(), never an update or a delete.
import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";

const trusted = mongoose.trusted;

// Which keys may appear in before/after per action: never tokens, secrets or email.
const ROLE_KEYS = ["role", "cityId", "departmentId", "stateCode"];
const ALLOWED_KEYS = {
  "user.role_change": ROLE_KEYS,
  "user.bootstrap_super_admin": ROLE_KEYS,
  "user.suspend": ["status", "suspendedReason"],
  "user.reactivate": ["status", "suspendedReason"],
  "user.mfa_flag_sync_failed": ["errorCode"],
  "user.identity_linked": ["provider"], // the provider only, never the full sub
  "issue.created": ["ticketId", "category", "queue", "departmentId"], // never the location or text
  // M2: the note or hold reason goes in `reason`, never in before/after.
  "issue.status_change": ["ticketId", "status"],
  "issue.assign": ["ticketId", "status", "queue", "departmentId"],
  "issue.hold": ["ticketId", "slaPausedAt", "expectedBy"],
  "issue.resume": ["ticketId", "slaPausedAt", "expectedBy"],
  // M3 moderation: never the post or comment text.
  "post.hide": ["status", "flagCount"],
  "post.restore": ["status", "flagCount"],
  "post.delete": ["status"],
  "comment.hide": ["status", "flagCount"],
  "comment.restore": ["status", "flagCount"],
  "comment.delete": ["status"],
  // M3 city settings: routing and hours for one category.
  "city.category_update": ["category", "departmentId", "queue", "respondHours", "resolveHours"],
  "city.create": ["name", "code", "stateCode", "status"],
  "city.update": ["name", "status"],
};
const targetOf = (action) => action.split(".")[0];

/** Keeps only the allow-listed keys with a value. Returns undefined when nothing is left. */
function snapshot(action, values) {
  if (!values) return undefined;
  const kept = Object.fromEntries(
    ALLOWED_KEYS[action].filter((k) => values[k] !== undefined).map((k) => [k, values[k]]),
  );
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/**
 * Appends one audit row. Pass `session` to make it part of the caller's transaction, so the change
 * and its audit row commit or fail together.
 * entry: { actorType, actorId?, actorLabel?, actorRole?, action, targetId, cityId?, before?, after?,
 *          reason?, ip?, requestId? }
 */
export async function record(entry, { session } = {}) {
  if (!Object.hasOwn(ALLOWED_KEYS, entry.action))
    throw new Error(`Unknown audit action ${entry.action}`);
  const doc = {
    ...entry,
    targetType: targetOf(entry.action),
    before: snapshot(entry.action, entry.before),
    after: snapshot(entry.action, entry.after),
  };
  // create([doc], { session }) is the array form Mongoose requires when passing options.
  const [row] = await AuditLog.create([doc], { session });
  return { id: String(row._id) };
}

/**
 * GET /api/admin/audit: newest first, keyset on (at, _id). A city admin sees their city's rows only;
 * super_admin sees all. Optional filters: action, targetType, targetId. Rows carry ids, never email.
 */
export async function listAudit(actor, { action, targetType, targetId, cursor, limit }) {
  const filter = {};
  if (actor.role !== "super_admin") filter.cityId = actor.cityId;
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (targetId) filter.targetId = targetId;
  if (cursor) {
    const c = decodeCursor(cursor);
    filter.$or = [
      { at: trusted({ $lt: c.createdAt }) },
      { at: c.createdAt, _id: trusted({ $lt: c._id }) },
    ];
  }
  const rows = await AuditLog.find(filter)
    .sort({ at: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items: items.map((r) => ({
      id: String(r._id),
      at: r.at,
      action: r.action,
      targetType: r.targetType,
      targetId: String(r.targetId),
      actor:
        r.actorType === "system"
          ? { type: "system", label: r.actorLabel }
          : { type: "user", id: String(r.actorId), role: r.actorRole },
      before: r.before ?? null,
      after: r.after ?? null,
      reason: r.reason ?? null,
    })),
    nextCursor: rows.length > limit ? encodeCursor({ createdAt: last.at, _id: last._id }) : null,
  };
}

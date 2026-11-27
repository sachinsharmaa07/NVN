// The only door to the AuditLog. It exports record() and reads, never an update or a delete.
import { AuditLog } from "../models/AuditLog.js";

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

const clampLimit = (limit) => Math.min(Math.max(Number(limit) || 20, 1), 50);

/** Newest-first history of one user (first page only; Phase 1 has no endpoint that needs more). */
export function listForTarget(targetId, limit = 20) {
  return AuditLog.find({ targetType: "user", targetId })
    .sort({ at: -1 })
    .limit(clampLimit(limit))
    .lean();
}

/** Newest-first global feed, first page only. */
export function listRecent(limit = 20) {
  return AuditLog.find().sort({ at: -1, _id: -1 }).limit(clampLimit(limit)).lean();
}

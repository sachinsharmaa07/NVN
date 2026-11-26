// Issue lists: the reporter's own (M2 step 2) and the staff queue (step 3). Scope is in the query.
import { Issue } from "../models/Issue.js";
import { decodeCursor, pageOf } from "../utils/cursor.js";
import { trusted } from "./adminUserSupport.js";
import { summary } from "./issueView.js";

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

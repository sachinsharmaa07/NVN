// Notifications. notify() joins the caller's transaction; the reads are the user's own only.
import { Notification } from "../models/Notification.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";
import { clock } from "../utils/clock.js";
import { trusted } from "./adminUserSupport.js";

/** One row per user id. `issue` needs _id, ticketId, status. Pass `session` to commit with the change. */
export async function notify(userIds, type, issue, { session } = {}) {
  if (!userIds.length) return;
  const rows = userIds.map((userId) => ({
    userId,
    issueId: issue._id,
    ticketId: issue.ticketId,
    type,
    status: issue.status,
  }));
  // ordered + session: the array form Mongoose requires when passing options.
  await Notification.create(rows, { session, ordered: true });
}

const view = (n) => ({
  id: String(n._id),
  type: n.type,
  ticketId: n.ticketId,
  status: n.status ?? null,
  read: n.readAt != null,
  createdAt: n.createdAt,
});

/** GET /api/notifications: mine, newest first, index { userId, createdAt, _id }. */
export async function listMine(actor, { cursor, limit }) {
  const filter = { userId: actor.id };
  if (cursor) {
    const c = decodeCursor(cursor);
    filter.$or = [
      { createdAt: trusted({ $lt: c.createdAt }) },
      { createdAt: c.createdAt, _id: trusted({ $lt: c._id }) },
    ];
  }
  const rows = await Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const items = rows.slice(0, limit);
  const unread = await Notification.countDocuments({ userId: actor.id, readAt: null });
  return {
    items: items.map(view),
    nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
    unread,
  };
}

/** POST /api/notifications/read: the given ids, or all of mine. Someone else's id is simply not matched. */
export async function markRead(actor, { ids }) {
  const filter = { userId: actor.id, readAt: null };
  if (ids) filter._id = trusted({ $in: ids });
  const { modifiedCount } = await Notification.updateMany(filter, {
    $set: { readAt: clock.now() },
  });
  return { updated: modifiedCount };
}

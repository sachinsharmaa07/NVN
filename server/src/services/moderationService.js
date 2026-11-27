// Moderation queue and actions (post:moderate). Scope is the moderator's city, applied in the query;
// anything outside it is the same 404 as a missing row. Every action is audited in its transaction.
import { Comment } from "../models/Comment.js";
import { Post } from "../models/Post.js";
import { decodeCursor, pageOf } from "../utils/cursor.js";
import { inTransaction, notFound, trusted } from "./adminUserSupport.js";
import {
  authorNames,
  commentView,
  MODELS,
  moderates,
  moveContent,
  postView,
} from "./communityShared.js";

const TO = Object.freeze({ hide: "hidden", restore: "published", delete: "deleted" });

const scopeOf = (actor) => (actor.role === "super_admin" ? {} : { cityId: actor.cityId });

/** GET /api/moderation/queue?type&status: hidden content by default, newest first. */
export async function listQueue(actor, { type, status, cursor, limit }) {
  const filter = { ...scopeOf(actor), status };
  if (cursor) {
    const c = decodeCursor(cursor);
    filter.$or = [
      { createdAt: trusted({ $lt: c.createdAt }) },
      { createdAt: c.createdAt, _id: trusted({ $lt: c._id }) },
    ];
  }
  const Model = type === "post" ? Post : Comment;
  const rows = await Model.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const { items, nextCursor } = pageOf(rows, limit);
  const names = await authorNames(items);
  const view = type === "post" ? postView : commentView;
  return {
    items: items.map((row) => ({
      ...view(row, actor, names),
      flagCount: row.flagCount,
      ...(type === "comment" && { postId: String(row.postId) }), // so the queue can link to the thread
    })),
    nextCursor,
  };
}

/** POST /api/moderation/:type/:id {action, reason}: hide, restore or delete content in scope. */
export async function moderate(actor, type, id, { action, reason }, ctx = {}) {
  return inTransaction(async (session) => {
    const doc = await MODELS[type].findById(id).session(session);
    if (!doc || doc.status === "deleted" || !moderates(actor, doc.cityId)) throw notFound();
    await moveContent(type, doc, TO[action], "moderator", { actor, reason, ctx, session });
    return { id: String(doc._id), status: doc.status, flagCount: doc.flagCount };
  });
}

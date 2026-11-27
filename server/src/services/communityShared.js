// Helpers for the community services: who moderates what, the JSON views, and the one status-change path
// (state machine + write + audit in the caller's transaction). No HTTP here.
import { Comment } from "../models/Comment.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { can, needsMfa } from "../utils/permissions.js";
import { checkContentTransition, needsReason } from "../utils/postStateMachine.js";
import { record } from "./auditService.js";
import { forbidden, notFound, sameId, trusted } from "./adminUserSupport.js";

export const MODELS = Object.freeze({ post: Post, comment: Comment });

/** Holds post:moderate for this city (super_admin: every city), with MFA where the role needs it. */
export function moderates(actor, cityId) {
  if (!can(actor.role, "post:moderate")) return false;
  if (needsMfa(actor.role, "post:moderate") && actor.mfa !== true) return false;
  return actor.role === "super_admin" || sameId(actor.cityId, cityId);
}

/** Published: everyone signed in. Hidden: its author and its moderators. Deleted: nobody (404). */
export function visibleTo(actor, doc) {
  if (doc.status === "published") return true;
  if (doc.status === "hidden")
    return sameId(doc.authorId, actor.id) || moderates(actor, doc.cityId);
  return false;
}

/** id -> display name for the authors of these rows. Names only: never email or role. */
export async function authorNames(rows) {
  const ids = [...new Set(rows.map((r) => String(r.authorId)))];
  if (!ids.length) return new Map();
  const users = await User.find({ _id: trusted({ $in: ids }) }, { name: 1 }).lean();
  return new Map(users.map((u) => [String(u._id), u.name ?? ""]));
}

export const postView = (p, actor, names) => ({
  id: String(p._id),
  pincode: p.pincode,
  title: p.title,
  body: p.body,
  author: names.get(String(p.authorId)) ?? "",
  mine: sameId(p.authorId, actor.id),
  status: p.status,
  commentCount: p.commentCount,
  createdAt: p.createdAt,
});

export const commentView = (c, actor, names) => ({
  id: String(c._id),
  parentId: c.parentId ? String(c.parentId) : null,
  body: c.body,
  author: names.get(String(c.authorId)) ?? "",
  mine: sameId(c.authorId, actor.id),
  status: c.status,
  createdAt: c.createdAt,
});

/** Loads one post or comment the actor may see, else the same 404 as a missing one. */
export async function loadVisible(kind, id, actor, session) {
  const doc = await MODELS[kind].findById(id).session(session ?? null);
  if (!doc || !visibleTo(actor, doc)) throw notFound();
  return doc;
}

/**
 * Moves `doc` (a post or comment document) to `to` as `who` ("author" | "moderator" | "system").
 * Keeps the post's commentCount equal to its published comments, and audits non-author moves.
 */
export async function moveContent(kind, doc, to, who, { actor, reason, ctx = {}, session }) {
  const verdict = checkContentTransition(doc.status, to, who);
  if (verdict === "forbidden") throw forbidden();
  if (verdict === "invalid") {
    throw new AppError("INVALID_TRANSITION", 400, `This ${kind} is already ${doc.status}.`);
  }
  if (needsReason(to, who) && !reason) {
    throw new AppError("VALIDATION_ERROR", 400, "Say why, so the author can learn from it.");
  }
  const from = doc.status;
  doc.status = to;
  if (to === "published") doc.flagCount = 0; // a restore starts clean; the old flaggers stay recorded
  await doc.save({ session });
  if (kind === "comment" && (from === "published") !== (to === "published")) {
    await Post.updateOne(
      { _id: doc.postId },
      { $inc: { commentCount: to === "published" ? 1 : -1 } },
      { session },
    );
  }
  if (who === "author") return doc;
  const action = `${kind}.${{ hidden: "hide", published: "restore", deleted: "delete" }[to]}`;
  const actorFields =
    who === "system"
      ? { actorType: "system", actorLabel: "community-flags" }
      : {
          actorType: "user",
          actorId: actor.id,
          actorRole: actor.role,
          ip: ctx.ip,
          requestId: ctx.requestId,
        };
  await record(
    {
      ...actorFields,
      action,
      targetId: doc._id,
      cityId: doc.cityId,
      before: { status: from },
      after: { status: to, flagCount: doc.flagCount },
      reason: reason || undefined,
    },
    { session },
  );
  return doc;
}

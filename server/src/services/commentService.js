// Comments on a post: two levels, oldest first, the client builds the tree. commentCount moves in the same
// transaction as the comment, so it always equals the post's published comments.
import { Comment } from "../models/Comment.js";
import { Post } from "../models/Post.js";
import { AppError } from "../utils/AppError.js";
import { decodeCursor, pageOf } from "../utils/cursor.js";
import { inTransaction, notFound, sameId, trusted } from "./adminUserSupport.js";
import { authorNames, commentView, loadVisible, moveContent } from "./communityShared.js";

/** GET /api/community/posts/:id/comments: published comments of a post the actor can see. */
export async function listComments(actor, postId, { cursor, limit }) {
  await loadVisible("post", postId, actor);
  const filter = { postId, status: "published" };
  if (cursor) {
    const c = decodeCursor(cursor);
    filter.$or = [
      { createdAt: trusted({ $gt: c.createdAt }) },
      { createdAt: c.createdAt, _id: trusted({ $gt: c._id }) },
    ];
  }
  const rows = await Comment.find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .limit(limit + 1)
    .lean();
  const { items, nextCursor } = pageOf(rows, limit);
  const names = await authorNames(items);
  return { items: items.map((c) => commentView(c, actor, names)), nextCursor };
}

/** POST /api/community/posts/:id/comments: on a published post; a reply's parent must be top level. */
export async function addComment(actor, postId, { body, parentId }) {
  return inTransaction(async (session) => {
    const post = await Post.findOne({ _id: postId, status: "published" }).session(session);
    if (!post) throw notFound();
    if (parentId) {
      const parent = await Comment.findOne(
        { _id: parentId, postId, status: "published" },
        { parentId: 1 },
      ).session(session);
      if (!parent) throw notFound();
      if (parent.parentId) {
        throw new AppError("VALIDATION_ERROR", 400, "Reply to the first comment in the thread.");
      }
    }
    const [comment] = await Comment.create(
      [{ postId, cityId: post.cityId, parentId: parentId ?? null, authorId: actor.id, body }],
      { session },
    );
    await Post.updateOne({ _id: postId }, { $inc: { commentCount: 1 } }, { session });
    return commentView(comment, actor, new Map([[actor.id, actor.name]]));
  });
}

/** DELETE /api/community/comments/:id: the author's own. Someone else's is the same 404. */
export async function deleteOwnComment(actor, id) {
  return inTransaction(async (session) => {
    const comment = await loadVisible("comment", id, actor, session);
    if (!sameId(comment.authorId, actor.id)) throw notFound();
    await moveContent("comment", comment, "deleted", "author", { actor, session });
    return { id: String(comment._id), status: comment.status };
  });
}

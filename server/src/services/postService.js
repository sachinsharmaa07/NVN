// Community posts (decision 7): read any pincode's feed, post only in your own default pincode.
import { Pincode } from "../models/Pincode.js";
import { Post } from "../models/Post.js";
import { AppError } from "../utils/AppError.js";
import { decodeCursor, pageOf } from "../utils/cursor.js";
import { inTransaction, notFound, sameId, trusted } from "./adminUserSupport.js";
import { servesReports } from "./pincodeService.js";
import { authorNames, loadVisible, moveContent, postView } from "./communityShared.js";

/** GET /api/community/posts?pincode: published posts, newest first (index { pincode, status, createdAt, _id }). */
export async function listFeed(actor, { pincode, cursor, limit }) {
  const filter = { pincode, status: "published" };
  if (cursor) {
    const c = decodeCursor(cursor);
    filter.$or = [
      { createdAt: trusted({ $lt: c.createdAt }) },
      { createdAt: c.createdAt, _id: trusted({ $lt: c._id }) },
    ];
  }
  const rows = await Post.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const { items, nextCursor } = pageOf(rows, limit);
  const names = await authorNames(items);
  return { items: items.map((p) => postView(p, actor, names)), nextCursor };
}

/** POST /api/community/posts: into the author's default pincode, which must be served by an active city. */
export async function createPost(actor, { title, body }) {
  if (!actor.defaultPincode) {
    throw new AppError(
      "PINCODE_REQUIRED",
      400,
      "Set your home pincode in your profile before posting.",
    );
  }
  const pin = await Pincode.findOne({ pin: actor.defaultPincode }, { isServed: 1, cityId: 1 })
    .populate("cityId", "status")
    .lean();
  if (!servesReports(pin?.isServed, pin?.cityId)) {
    throw new AppError("PINCODE_NOT_SERVED", 400, "Your pincode isn't covered yet.");
  }
  const post = await Post.create({
    pincode: actor.defaultPincode,
    cityId: pin.cityId._id,
    authorId: actor.id,
    title,
    body,
  });
  return postView(post, actor, new Map([[actor.id, actor.name]]));
}

/** GET /api/community/posts/:id: hidden ones only for the author and moderators; deleted is 404. */
export async function getPost(actor, id) {
  const post = await loadVisible("post", id, actor);
  return postView(post, actor, await authorNames([post]));
}

/** DELETE /api/community/posts/:id: the author's own soft delete. Someone else's is the same 404. */
export async function deleteOwnPost(actor, id) {
  return inTransaction(async (session) => {
    const post = await loadVisible("post", id, actor, session);
    if (!sameId(post.authorId, actor.id)) throw notFound();
    await moveContent("post", post, "deleted", "author", { actor, session });
    return { id: String(post._id), status: post.status };
  });
}

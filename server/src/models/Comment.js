// A comment on a post. Two levels only: parentId is null or a top-level comment of the same post.
import mongoose from "mongoose";
import { CONTENT_STATUSES } from "../utils/postStateMachine.js";

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema(
  {
    postId: { type: ObjectId, ref: "Post", required: true, immutable: true },
    cityId: { type: ObjectId, ref: "City", required: true, immutable: true }, // copied from the post
    parentId: { type: ObjectId, ref: "Comment", default: null, immutable: true },
    authorId: { type: ObjectId, ref: "User", required: true, immutable: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
    status: { type: String, enum: CONTENT_STATUSES, default: "published" },
    flagCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

commentSchema.index({ postId: 1, status: 1, createdAt: 1, _id: 1 }); // a thread, oldest first
commentSchema.index({ cityId: 1, status: 1, createdAt: -1, _id: -1 }); // moderation queue

export const Comment = mongoose.model("Comment", commentSchema);

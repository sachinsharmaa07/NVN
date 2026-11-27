// A community post in one pincode (decision 7, M3). Plain text: React escapes it, so no Markdown sanitiser.
import mongoose from "mongoose";
import { PINCODE_RE } from "../utils/india.js";
import { CONTENT_STATUSES } from "../utils/postStateMachine.js";

const { ObjectId } = mongoose.Schema.Types;

const postSchema = new mongoose.Schema(
  {
    pincode: { type: String, required: true, match: PINCODE_RE, immutable: true },
    cityId: { type: ObjectId, ref: "City", required: true, immutable: true }, // moderator scope
    authorId: { type: ObjectId, ref: "User", required: true, immutable: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 100 },
    body: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    status: { type: String, enum: CONTENT_STATUSES, default: "published" },
    flagCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 }, // published comments only
  },
  { timestamps: true },
);

postSchema.index({ pincode: 1, status: 1, createdAt: -1, _id: -1 }); // the feed
postSchema.index({ cityId: 1, status: 1, createdAt: -1, _id: -1 }); // moderation queue

export const Post = mongoose.model("Post", postSchema);

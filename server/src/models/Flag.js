// One user's report of a post or comment. The unique index makes a repeat flag a no-op.
import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

export const FLAG_TARGETS = Object.freeze(["post", "comment"]);
export const FLAG_REASONS = Object.freeze(["spam", "abuse", "personal_info", "off_topic", "other"]);

const flagSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: FLAG_TARGETS, required: true, immutable: true },
    targetId: { type: ObjectId, required: true, immutable: true },
    userId: { type: ObjectId, ref: "User", required: true, immutable: true },
    reason: { type: String, enum: FLAG_REASONS, required: true, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

flagSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });

export const Flag = mongoose.model("Flag", flagSchema);

// Append-only record of who changed what. Written only through services/auditService.js.
import mongoose from "mongoose";
import { clock } from "../utils/clock.js";
import { ROLES } from "../utils/permissions.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const AUDIT_ACTIONS = [
  "user.role_change",
  "user.suspend",
  "user.reactivate",
  "user.bootstrap_super_admin",
  "user.mfa_flag_sync_failed",
  "user.identity_linked",
  "issue.created",
  "issue.status_change",
  "issue.assign",
  "issue.hold",
  "issue.resume",
  "post.hide",
  "post.restore",
  "post.delete",
  "comment.hide",
  "comment.restore",
  "comment.delete",
  "city.category_update",
  "city.create",
  "city.update",
  "department.create",
  "department.update",
];
export const AUDIT_TARGETS = ["user", "issue", "post", "comment", "city", "department"];

const MAX_SNAPSHOT_BYTES = 4096;
const smallEnough = (v) => v == null || JSON.stringify(v).length <= MAX_SNAPSHOT_BYTES;

const auditLogSchema = new mongoose.Schema(
  {
    actorType: { type: String, enum: ["user", "system"], required: true, immutable: true },
    actorId: { type: ObjectId, ref: "User", immutable: true }, // required iff actorType is user
    actorLabel: { type: String, maxlength: 64, immutable: true }, // required iff system
    actorRole: { type: String, enum: ROLES, immutable: true }, // the actor's role at that time
    action: { type: String, enum: AUDIT_ACTIONS, required: true, immutable: true },
    targetType: {
      type: String,
      enum: AUDIT_TARGETS,
      required: true,
      default: "user",
      immutable: true,
    },
    // No `ref`: the log outlives its targets.
    targetId: { type: ObjectId, required: true, immutable: true },
    cityId: { type: ObjectId, immutable: true }, // snapshot of the target's city; cannot be back-filled
    before: { type: Mixed, immutable: true, validate: smallEnough },
    after: { type: Mixed, immutable: true, validate: smallEnough },
    reason: { type: String, trim: true, minlength: 3, maxlength: 500, immutable: true },
    ip: { type: String, maxlength: 45, immutable: true },
    requestId: { type: String, maxlength: 64, immutable: true },
    at: { type: Date, required: true, default: () => clock.now(), immutable: true },
  },
  { timestamps: false, versionKey: false },
);

auditLogSchema.pre("validate", function () {
  const isUser = this.actorType === "user";
  if (isUser !== (this.actorId != null))
    this.invalidate("actorId", "required iff actorType is user");
  if (isUser !== (this.actorRole != null))
    this.invalidate("actorRole", "required iff actorType is user");
  if (!isUser && !this.actorLabel) this.invalidate("actorLabel", "required for system actors");
  const needsReason = ["user.role_change", "user.suspend", "user.reactivate"];
  if (needsReason.includes(this.action) && !this.reason) this.invalidate("reason", "required");
});

// Append-only: every way of changing or removing a row throws. This stops mistakes in our own code;
// it cannot stop a raw driver call or a stolen credential (docs/phase-1-auth.md 6.3).
const refuse = () => {
  throw new Error("AuditLog is append-only");
};
auditLogSchema.pre(
  [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "findOneAndReplace",
    "findOneAndDelete",
    "replaceOne",
    "deleteMany",
  ],
  { query: true, document: false },
  refuse,
);
auditLogSchema.pre("deleteOne", { query: true, document: true }, refuse);
auditLogSchema.pre("updateOne", { query: false, document: true }, refuse);
auditLogSchema.pre("bulkWrite", refuse);
auditLogSchema.pre("save", function () {
  if (!this.isNew) refuse();
});

auditLogSchema.index({ targetType: 1, targetId: 1, at: -1 }); // history of one user
auditLogSchema.index({ at: -1, _id: -1 }); // global feed
auditLogSchema.index({ actorId: 1, at: -1 }); // what an admin did
auditLogSchema.index({ cityId: 1, at: -1, _id: -1 }); // a city admin's audit feed

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);

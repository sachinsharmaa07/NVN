// A reported civic issue. Written only by issueService, inside the submit transaction.
import mongoose from "mongoose";
import { CATEGORIES } from "../utils/categories.js";
import { PINCODE_RE } from "../utils/india.js";
import { ROLES } from "../utils/permissions.js";
import { QUEUES } from "./CategoryMapping.js";

const { ObjectId } = mongoose.Schema.Types;

// Decision M1-2. "On hold" is the slaPausedAt flag, not a status.
export const ISSUE_STATUSES = Object.freeze([
  "submitted",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "reopened",
  "rejected",
]);
export const PRECISIONS = Object.freeze(["exact", "approx"]); // decision M1-7
export const TICKET_RE = /^NIV-\d{4}-\d{6}$/;
export const MAX_PHOTOS = 3;
export const SLA_STATES = Object.freeze(["on_track", "at_risk", "breached"]);
export const NOTE_MAX = 500;

const photoSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, maxlength: 200 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ISSUE_STATUSES, required: true },
    at: { type: Date, required: true },
    by: { type: ObjectId, ref: "User", default: null }, // null: the SLA job (role "system")
    role: { type: String, enum: [...ROLES, "system"] }, // M2; M1 rows have none
    note: { type: String, trim: true, maxlength: NOTE_MAX },
  },
  { _id: false },
);

const issueSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, match: TICKET_RE, immutable: true },
    reporterId: { type: ObjectId, ref: "User", required: true, immutable: true },
    cityId: { type: ObjectId, ref: "City", required: true },
    pincode: { type: String, required: true, match: PINCODE_RE },
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: ([lng, lat, ...rest]) =>
            rest.length === 0 && Math.abs(lng) <= 180 && Math.abs(lat) <= 90,
          message: "coordinates must be [lng, lat]",
        },
      },
    },
    // How the pin was checked when it was submitted: a polygon or the radius circle.
    precision: { type: String, enum: PRECISIONS, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    departmentId: { type: ObjectId, ref: "Department", default: null },
    queue: { type: String, enum: QUEUES, required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 100 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 1000 },
    photos: {
      type: [photoSchema],
      default: [],
      validate: { validator: (v) => v.length <= MAX_PHOTOS, message: "at most 3 photos" },
    },
    status: { type: String, enum: ISSUE_STATUSES, required: true, default: "submitted" },
    statusHistory: { type: [historySchema], default: [] },
    afterPhotos: {
      type: [photoSchema],
      default: [],
      validate: { validator: (v) => v.length <= MAX_PHOTOS, message: "at most 3 photos" },
    },
    slaPausedAt: { type: Date, default: null },
    holdReason: { type: String, trim: true, maxlength: NOTE_MAX, default: null },
    expectedBy: { type: Date, required: true },
    // Respond-by (decision 3): when it must be assigned. Old issues have none, so the job skips them.
    respondBy: { type: Date, default: null },
    respondNotifiedAt: { type: Date, default: null },
    // 75% of the allowed time, stored so the SLA job finds due issues with an index (M2).
    atRiskAt: { type: Date, default: null },
    slaState: { type: String, enum: SLA_STATES, default: "on_track" },
    resolvedAt: { type: Date, default: null },
    // Escalation steps already sent; the SLA job sets each once (idempotence).
    breachNotifiedDeptHeadAt: { type: Date, default: null },
    breachNotifiedCityAdminAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true, immutable: true, maxlength: 64 },
  },
  { timestamps: true },
);

issueSchema.pre("validate", function () {
  if ((this.queue === "triage") !== (this.departmentId == null)) {
    this.invalidate("queue", 'queue is "triage" exactly when there is no departmentId');
  }
});

issueSchema.index({ ticketId: 1 }, { unique: true });
issueSchema.index({ location: "2dsphere" });
issueSchema.index({ reporterId: 1, createdAt: -1 }); // "my issues"
issueSchema.index({ cityId: 1, queue: 1, status: 1, createdAt: -1 }); // staff queues (M1)
// M2 staff queue, sorted by due date: by department (staff, dept_head) or by city (city_admin).
issueSchema.index({ departmentId: 1, expectedBy: 1, createdAt: 1, _id: 1 });
issueSchema.index({ cityId: 1, expectedBy: 1, createdAt: 1, _id: 1 });
issueSchema.index({ expectedBy: 1, createdAt: 1, _id: 1 }); // super_admin, national
// M2 SLA job: at risk, breached, escalation, auto-close. Stats: open by category.
issueSchema.index({ slaState: 1, atRiskAt: 1 });
issueSchema.index({ slaState: 1, expectedBy: 1 });
issueSchema.index({ slaState: 1, breachNotifiedDeptHeadAt: 1, breachNotifiedCityAdminAt: 1 });
issueSchema.index({ status: 1, resolvedAt: 1 });
issueSchema.index({ status: 1, respondBy: 1 }); // SLA job: not assigned in time
issueSchema.index({ status: 1, category: 1 });
// A replayed submit finds the first issue; a racing duplicate hits E11000.
issueSchema.index({ reporterId: 1, idempotencyKey: 1 }, { unique: true });

export const Issue = mongoose.model("Issue", issueSchema);

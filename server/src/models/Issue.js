// A reported civic issue (M1 step 8). Written only by issueService, inside the submit transaction.
import mongoose from "mongoose";
import { CATEGORIES } from "../utils/categories.js";
import { PINCODE_RE } from "../utils/india.js";
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
    by: { type: ObjectId, ref: "User", required: true },
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
    slaPausedAt: { type: Date, default: null },
    expectedBy: { type: Date, required: true },
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
issueSchema.index({ cityId: 1, queue: 1, status: 1, createdAt: -1 }); // staff queues
// A replayed submit finds the first issue; a racing duplicate hits E11000.
issueSchema.index({ reporterId: 1, idempotencyKey: 1 }, { unique: true });

export const Issue = mongoose.model("Issue", issueSchema);

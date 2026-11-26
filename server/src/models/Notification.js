// In-app notifications (decision 6, M2). Created inside the status-change transaction for the reporter and
// by the SLA job for staff. No free text: the client renders `type` + `ticketId` + `status` through i18n.
import mongoose from "mongoose";
import { ISSUE_STATUSES, TICKET_RE } from "./Issue.js";

const { ObjectId } = mongoose.Schema.Types;

export const NOTIFICATION_TYPES = Object.freeze([
  "status_changed", // reporter: staff moved the issue
  "on_hold", // reporter
  "resumed", // reporter
  "sla_breached", // dept_head (or city_admin for a triage issue)
  "sla_escalated", // city_admin, 24 h after the breach
]);
export const NOTIFICATION_TTL_SECONDS = 90 * 24 * 3600;

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, immutable: true },
    issueId: { type: ObjectId, ref: "Issue", required: true, immutable: true },
    ticketId: { type: String, required: true, match: TICKET_RE, immutable: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, immutable: true },
    status: { type: String, enum: ISSUE_STATUSES, immutable: true }, // the issue's status at that time
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 }); // my notifications, newest first
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_SECONDS });

export const Notification = mongoose.model("Notification", notificationSchema);

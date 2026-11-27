// Email outbox (decision 6). Notification rows are written inside the business transaction; this sends
// their emails afterwards, so a slow or failing mail server never blocks or rolls back a status change.
// Run right after a write (fire and forget) and on every SLA tick, which retries failures.
import { logger } from "../config/logger.js";
import { config } from "../config/env.js";
import { Issue } from "../models/Issue.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { clock } from "../utils/clock.js";
import { trusted } from "./adminUserSupport.js";
import { emailEnabled, sendEmail } from "./emailService.js";
import { renderNotificationEmail } from "./emailTemplates.js";

const log = logger.child({ component: "email-outbox" });
export const MAX_ATTEMPTS = 3;
// Older rows are not emailed: turning email on must not mail out every old notification.
export const MAX_AGE_MS = 24 * 3600_000;

/** Sends up to `limit` pending emails. Returns { sent, failed, skipped }. */
export async function drainEmails({ limit = 50, now = clock.now() } = {}) {
  const result = { sent: 0, failed: 0, skipped: 0 };
  if (!emailEnabled()) return result;
  const pending = await Notification.find({
    emailedAt: null,
    emailAttempts: trusted({ $lt: MAX_ATTEMPTS }),
    createdAt: trusted({ $gte: new Date(now - MAX_AGE_MS) }),
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

  for (const n of pending) {
    // Claim first: an overlapping drain skips the row, so nobody gets the same email twice.
    const claim = await Notification.updateOne(
      { _id: n._id, emailedAt: null },
      { $set: { emailedAt: now }, $inc: { emailAttempts: 1 } },
    );
    if (claim.modifiedCount === 0) continue;
    const user = await User.findById(
      n.userId,
      "email name preferredLanguage status emailVerified",
    ).lean();
    if (!user || user.status !== "active" || !user.emailVerified) {
      result.skipped += 1; // stays claimed: never mail a suspended or unverified address
      continue;
    }
    const issue = await Issue.findById(n.issueId, "title expectedBy").lean();
    const mail = renderNotificationEmail(n, {
      name: user.name,
      lang: user.preferredLanguage,
      title: issue?.title,
      expectedBy: issue?.expectedBy,
      appUrl: config.CLIENT_URL,
    });
    try {
      await sendEmail({ to: user.email, ...mail });
      result.sent += 1;
    } catch (err) {
      // Release the claim so the next drain retries, until MAX_ATTEMPTS.
      await Notification.updateOne({ _id: n._id }, { $set: { emailedAt: null } });
      result.failed += 1;
      log.warn(
        { event: "email.failed", notificationId: String(n._id), code: err?.code },
        "Email failed",
      );
    }
  }
  return result;
}

/** Fire and forget after a committed write; errors are logged, never thrown at the request. */
export function drainSoon() {
  drainEmails().catch((err) =>
    log.error({ event: "email.drain_failed", err }, "Email drain failed"),
  );
}

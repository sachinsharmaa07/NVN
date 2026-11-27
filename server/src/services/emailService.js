// The only door to SMTP (decision 6, Gmail by default). Without SMTP_USER and SMTP_PASS it logs the subject
// instead of sending, so development and tests never send real email. Never logs addresses or bodies.
import nodemailer from "nodemailer";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";

const log = logger.child({ component: "email" });
let transport;

export const emailEnabled = () => Boolean(config.SMTP_USER && config.SMTP_PASS);

/** Sends one email. Throws on failure so the outbox can count the attempt and retry. */
export async function sendEmail({ to, subject, html, text }) {
  if (!emailEnabled()) {
    log.info({ event: "email.skipped", subject }, "Email not configured; not sent");
    return { sent: false };
  }
  transport ??= nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await transport.sendMail({
    from: config.EMAIL_FROM ?? `Nivaran <${config.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
  return { sent: true };
}

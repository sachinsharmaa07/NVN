// POST /api/waitlist. Decision O1: only an HMAC of the email is stored, never the address.
import { createHmac } from "node:crypto";
import { config } from "../config/env.js";
import { Waitlist } from "../models/Waitlist.js";
import { AppError } from "../utils/AppError.js";

/** Idempotent: a repeat sign-up hits the unique { pin, emailHash } index and gets the same answer. */
export async function joinWaitlist({ pin, email }) {
  if (!config.HMAC_SECRET) {
    throw new AppError("WAITLIST_NOT_CONFIGURED", 503, "The waitlist is not available right now.");
  }
  const emailHash = createHmac("sha256", config.HMAC_SECRET)
    .update(email.trim().toLowerCase())
    .digest("hex");
  try {
    await Waitlist.create({ pin, emailHash });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  // Same body for new and repeat, so the endpoint never reveals whether an email was already listed.
  return { joined: true };
}

// POST /api/waitlist. Decision O1: only an HMAC of the email is stored, never the address.
import { createHmac } from "node:crypto";
import { config } from "../config/env.js";
import { Pincode } from "../models/Pincode.js";
import { Waitlist } from "../models/Waitlist.js";
import { AppError } from "../utils/AppError.js";
import { trusted } from "./adminUserSupport.js";

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

/**
 * GET /api/admin/waitlist: the pincodes with the most sign-ups, to pick the next city to onboard. A top-N
 * report, not a cursor list (a count has no stable keyset). Email hashes never leave this function.
 * shortcut: the $group reads every sign-up, fine to a few hundred thousand; keep a per-pin counter past that.
 */
export async function waitlistDemand({ limit = 20 }) {
  const top = await Waitlist.aggregate([
    { $group: { _id: "$pin", count: { $sum: 1 }, latestAt: { $max: "$createdAt" } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ]);
  // One lookup for the whole page, never one per row.
  const pins = await Pincode.find(
    { pin: trusted({ $in: top.map((t) => t._id) }) },
    "pin district state isServed",
  ).lean();
  const byPin = new Map(pins.map((p) => [p.pin, p]));
  return {
    items: top.map((t) => {
      const p = byPin.get(t._id);
      return {
        pin: t._id,
        count: t.count,
        latestAt: t.latestAt,
        district: p?.district ?? null,
        state: p?.state ?? null,
        isServed: p?.isServed ?? false,
      };
    }),
  };
}

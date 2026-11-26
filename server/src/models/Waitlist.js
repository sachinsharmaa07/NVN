// People waiting for an unserved pincode. Decision O1: only an HMAC of the email is stored, so the
// list dedupes sign-ups but can never be used to email anyone.
import mongoose from "mongoose";
import { PINCODE_RE } from "../utils/india.js";

const waitlistSchema = new mongoose.Schema(
  {
    pin: {
      type: String,
      required: true,
      validate: {
        validator: (v) => PINCODE_RE.test(v),
        message: "pin must be 6 digits, not 0xxxxx",
      },
    },
    // HMAC-SHA-256(HMAC_SECRET, lowercased email) as 64 lowercase hex characters.
    emailHash: { type: String, required: true, match: /^[0-9a-f]{64}$/ },
  },
  { timestamps: true },
);

// One sign-up per person per pincode; a repeat insert hits E11000 and is treated as success.
waitlistSchema.index({ pin: 1, emailHash: 1 }, { unique: true });

export const Waitlist = mongoose.model("Waitlist", waitlistSchema);

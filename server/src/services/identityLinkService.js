// Adds a new sign-in id (token `sub`) to the user who owns the same VERIFIED email, so Google and
// email-code sign-ins land on one account. Called only from userService.resolveRequestUser.
// Never links an unverified email: that would let anyone who types a victim's address take over.
import { logger } from "../config/logger.js";
import { MAX_SIGN_IN_IDS, User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { MFA_MIN_LEVEL, levelOf } from "../utils/permissions.js";
import * as audit from "./auditService.js";
import { inTransaction, trusted } from "./adminUserSupport.js";
import { setFlagOrThrow } from "./mfaFlagService.js";

const log = logger.child({ component: "identityLinkService" });

/** Returns the linked user (lean), or null when there is nothing to link to. */
export async function linkByVerifiedEmail(claims, email, ctx = {}) {
  if (claims.emailVerified !== true || !email) return null;
  const owner = await User.findOne({ email, emailVerified: true }, { _id: 1, role: 1 }).lean();
  if (!owner) return null;
  const sub = claims.auth0Id;
  const userId = String(owner._id);

  // Admins fail closed: the new id must demand MFA in Auth0 before it can sign in as this user.
  if (levelOf(owner.role) >= MFA_MIN_LEVEL) {
    await setFlagOrThrow([sub], true, { log: ctx.log, userId });
  }

  const provider = sub.split("|")[0];
  const linkedNow = await inTransaction(async (session) => {
    const res = await User.updateOne(
      {
        _id: owner._id,
        emailVerified: true,
        auth0Ids: trusted({ $ne: sub }),
        [`auth0Ids.${MAX_SIGN_IN_IDS - 1}`]: trusted({ $exists: false }), // cap
      },
      { $addToSet: { auth0Ids: sub } },
      { session },
    );
    if (res.modifiedCount !== 1) return false; // a racing request linked it already, or the cap is hit
    await audit.record(
      {
        actorType: "system",
        actorLabel: "auth:link",
        action: "user.identity_linked",
        targetId: owner._id,
        after: { provider },
        requestId: ctx.requestId,
      },
      { session },
    );
    return true;
  });
  // Logged after commit: a transaction retry must not log the link twice.
  if (linkedNow)
    log.info({ event: "auth.identity_linked", userId, provider }, "Linked a new sign-in id");

  const linked = await User.findOne({ auth0Ids: sub }).lean();
  if (!linked) {
    throw new AppError(
      "IDENTITY_LIMIT",
      409,
      "This account has too many sign-in methods. Contact support.",
    );
  }
  return linked;
}

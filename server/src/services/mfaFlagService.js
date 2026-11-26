// Keeps Auth0's `mfa_required` flag in step with our roles, and the one-off bootstrap of the first
// super admin. Order matters: the only dangerous state is an admin without MFA (docs 7.2).
import { logger } from "../config/logger.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { MFA_MIN_LEVEL, levelOf } from "../utils/permissions.js";
import { setMfaRequired } from "./authProviderService.js";
import * as audit from "./auditService.js";
import { inTransaction, trusted } from "./adminUserSupport.js";

const log = logger.child({ component: "mfaFlagService" });

export const requiresMfaFlag = (role) => levelOf(role) >= MFA_MIN_LEVEL;

/**
 * Sets the flag on every sign-in id or throws 503 at the first failure (one id without MFA would be
 * a way round it). Any non-AppError (network, timeout) is mapped, never leaked.
 */
export async function setFlagOrThrow(auth0Ids, required, ctx = {}) {
  try {
    for (const id of auth0Ids) await setMfaRequired(id, required, ctx);
  } catch (err) {
    if (err instanceof AppError) throw err;
    log.error({ event: "mgmt.api_error", err }, "Management API call failed");
    throw new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      503,
      "The sign-in service is unavailable. Nothing was changed.",
    );
  }
}

/**
 * Demotion path: the DB change is already committed, so clearing the flag is best effort. One retry,
 * then a loud log and an audit note; syncMfaFlags.js clears it later.
 */
export async function clearFlagBestEffort(target, actor, ctx = {}) {
  let failure;
  for (const id of target.auth0Ids) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await setMfaRequired(id, false, { log: ctx.log, userId: String(target._id) });
        break;
      } catch (err) {
        if (attempt === 1) failure = err;
      }
    }
  }
  if (!failure) return true;
  const errorCode = failure?.code ?? failure?.name ?? "UNKNOWN";
  (ctx.log ?? log).error(
    { event: "auth0.mfa_flag_clear_pending", userId: String(target._id), errorCode },
    "Could not clear mfa_required; run npm run sync:mfa-flags",
  );
  try {
    await audit.record({
      actorType: "user",
      actorId: actor.id,
      actorRole: actor.role,
      action: "user.mfa_flag_sync_failed",
      targetId: target._id,
      after: { errorCode: String(errorCode) },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
  } catch (err) {
    log.error(
      { event: "admin.audit_write_failed", err },
      "Audit note for flag failure not written",
    );
  }
  return false;
}

const BOOTSTRAP = (code, status, message, details) => new AppError(code, status, message, details);

/**
 * Promotes the one verified, active, unique account with this email to super_admin.
 * Never creates a user. Idempotent: an existing super_admin only has the Auth0 flag re-asserted.
 * Refuses when another super_admin exists unless `force`. Throws AppError with a BOOTSTRAP_* code;
 * the script maps each to its exit code.
 */
export async function promoteToSuperAdmin(email, { force = false } = {}) {
  const wanted = String(email ?? "")
    .trim()
    .toLowerCase();
  // Only VERIFIED rows count: an unverified sign-up with the same address must never block or win.
  // Email is not unique, so list the ids when several verified rows match.
  const matches = await User.find({ email: wanted, emailVerified: true }).limit(10).lean();
  if (matches.length === 0) {
    if (await User.exists({ email: wanted })) {
      throw BOOTSTRAP("BOOTSTRAP_UNVERIFIED", 409, "That email is not verified.");
    }
    throw BOOTSTRAP("BOOTSTRAP_NOT_FOUND", 404, "No user has that email. Sign in once first.");
  }
  if (matches.length > 1) {
    throw BOOTSTRAP("BOOTSTRAP_AMBIGUOUS", 409, "More than one user has that email.", {
      ids: matches.map((m) => String(m._id)),
    });
  }
  const user = matches[0];
  if (user.status === "suspended")
    throw BOOTSTRAP("BOOTSTRAP_SUSPENDED", 409, "That account is suspended.");
  const alreadySuper = user.role === "super_admin";
  // A second super_admin is a platform-level decision: refuse unless the operator says --force.
  if (!alreadySuper && !force) {
    const other = await User.exists({ role: "super_admin", _id: trusted({ $ne: user._id }) });
    if (other) {
      throw BOOTSTRAP("BOOTSTRAP_OTHER_EXISTS", 409, "A super_admin already exists. Use --force.", {
        ids: [String(other._id)],
      });
    }
  }

  // Flag first: if Auth0 is down nothing is written, and a retry is safe.
  try {
    await setFlagOrThrow(user.auth0Ids, true, { userId: String(user._id) });
  } catch (err) {
    throw BOOTSTRAP("BOOTSTRAP_PROVIDER_FAILED", 503, "Could not set mfa_required in Auth0.", {
      cause: err.code,
    });
  }
  if (alreadySuper)
    return {
      outcome: "unchanged",
      userId: String(user._id),
      before: "super_admin",
      after: "super_admin",
    };

  const auditId = await inTransaction(async (session) => {
    // Re-read inside the transaction with the role as we saw it: if someone changed it meanwhile, no match.
    const doc = await User.findOne({ _id: user._id, role: user.role, status: "active" }).session(
      session,
    );
    if (!doc)
      throw BOOTSTRAP("BOOTSTRAP_CONFLICT", 409, "The user changed while promoting. Run it again.");
    const before = {
      role: doc.role,
      cityId: doc.cityId,
      departmentId: doc.departmentId,
      stateCode: doc.stateCode,
    };
    doc.role = "super_admin";
    doc.cityId = doc.departmentId = doc.stateCode = undefined; // super_admin carries no scope
    await doc.save({ session });
    const row = await audit.record(
      {
        actorType: "system",
        actorLabel: "script:bootstrap-super-admin",
        action: "user.bootstrap_super_admin",
        targetId: doc._id,
        before,
        after: { role: "super_admin" },
        reason: "bootstrap SUPER_ADMIN_EMAIL",
      },
      { session },
    );
    return row.id;
  });
  log.warn({ event: "admin.bootstrap", userId: String(user._id) }, "Super admin bootstrapped");
  return {
    outcome: "promoted",
    userId: String(user._id),
    before: user.role,
    after: "super_admin",
    auditId,
  };
}

/**
 * Sets the Auth0 flag from the DB for every user (true for level >= 4, false below). Safe to rerun.
 * Streams users with a cursor and calls Auth0 one at a time to stay under its rate limits.
 */
export async function syncMfaFlags({ onProgress } = {}) {
  const totals = { total: 0, required: 0, cleared: 0, failed: 0 };
  const cursor = User.find({}, { auth0Ids: 1, role: 1 }).lean().cursor();
  for await (const user of cursor) {
    const required = requiresMfaFlag(user.role);
    // Counted per sign-in id: each is its own Auth0 user with its own flag.
    for (const id of user.auth0Ids) {
      totals.total += 1;
      try {
        await setMfaRequired(id, required, { userId: String(user._id) });
        totals[required ? "required" : "cleared"] += 1;
      } catch (err) {
        totals.failed += 1;
        log.error(
          { event: "mgmt.api_error", userId: String(user._id), errorCode: err?.code },
          "Flag sync failed",
        );
      }
    }
    onProgress?.(totals);
  }
  return totals;
}

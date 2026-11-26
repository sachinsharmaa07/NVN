// Steps 2 to 5 after authenticate: load the user, then check status, verified email and permission.
// Scope is checked in the service, not here (docs/phase-1-auth.md section 4).
import { AppError } from "../utils/AppError.js";
import { PERMISSIONS, can, needsMfa } from "../utils/permissions.js";
import { readClaims, resolveRequestUser } from "../services/userService.js";

/**
 * Loads (or creates, on the first request) the user from MongoDB on every request, so suspending or
 * demoting someone works at once. Sets req.user; role, scope and status never come from the token.
 */
export async function loadUser(req, res, next) {
  try {
    req.user = await resolveRequestUser(readClaims(req.auth.payload), {
      log: req.log,
      requestId: req.id,
    });
  } catch (err) {
    if (err instanceof AppError) throw err; // e.g. TOKEN_CLAIMS_MISSING
    // The database is the source of truth: if it fails we fail closed, never fall back to the token.
    req.log?.error({ event: "auth.load_user_failed", err }, "Could not load the user");
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      503,
      "We can't reach our records right now. Try again.",
    );
  }
  next();
}

/** A suspended user is blocked on the very next request, with the reason for the Suspended page. */
export function requireActive(req, res, next) {
  if (req.user.status !== "active") {
    // The reason text is shown to the user but never logged (it is free text).
    req.log?.warn(
      {
        event: "auth.suspended_blocked",
        userId: req.user.id,
        role: req.user.role,
        route: req.path,
      },
      "Suspended user blocked",
    );
    throw new AppError("SUSPENDED", 403, "Your account is suspended.", {
      reason: req.user.suspendedReason ?? null,
    });
  }
  next();
}

/** Only the token claim `=== true` counts: the string "true", 1 or a missing claim all fail. */
export function requireVerifiedEmail(req, res, next) {
  if (req.user.emailVerified !== true) {
    req.log?.info({ event: "auth.unverified_blocked", userId: req.user.id, route: req.path });
    throw new AppError("EMAIL_NOT_VERIFIED", 403, "Verify your email to do this.");
  }
  next();
}

/**
 * requirePermission("user:promote"): the DB role must hold it, and for level >= 4 on an MFA-flagged
 * permission the token must show MFA (fail closed). An unknown permission name is a coding mistake,
 * so it throws when the route is defined, not when a user hits it.
 */
export function requirePermission(permission) {
  if (!Object.hasOwn(PERMISSIONS, permission)) {
    throw new Error(`requirePermission: unknown permission "${permission}"`);
  }
  return (req, res, next) => {
    const role = req.user?.role;
    // Doc order: verified email (4) before permission (5). Only the token claim `=== true` counts.
    if (PERMISSIONS[permission].verified && req.user?.emailVerified !== true) {
      req.log?.info({ event: "auth.unverified_blocked", userId: req.user?.id, route: req.path });
      throw new AppError("EMAIL_NOT_VERIFIED", 403, "Verify your email to do this.");
    }
    if (!can(role, permission)) {
      throw new AppError("FORBIDDEN", 403, "You don't have access to this.");
    }
    if (needsMfa(role, permission) && req.user.mfa !== true) {
      req.log?.warn(
        { event: "auth.mfa_required_blocked", userId: req.user.id, role, route: req.path },
        "MFA required",
      );
      throw new AppError("MFA_REQUIRED", 403, "Sign in again with two-step verification.");
    }
    next();
  };
}

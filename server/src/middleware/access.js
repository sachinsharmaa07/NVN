// Steps 2 to 4 after authenticate: load the user, then check verified email, permission and scope.
import { AppError } from "../utils/AppError.js";
import { hasPermission, inScope } from "../utils/access.js";
import { assertActive, findByAuth0Id, readClaims, toRequestUser } from "../services/userService.js";

/** Loads the user from MongoDB on every request, so suspending or demoting someone works at once. */
export async function loadUser(req, res, next) {
  const claims = readClaims(req.auth.payload);
  const record = await findByAuth0Id(claims.auth0Id);
  if (!record) {
    throw new AppError("USER_NOT_REGISTERED", 403, "Finish signing in first, then try again.");
  }
  assertActive(record);
  req.user = toRequestUser(record, claims);
  next();
}

export function requireVerifiedEmail(req, res, next) {
  if (!req.user.emailVerified) {
    throw new AppError("EMAIL_NOT_VERIFIED", 403, "Verify your email to do this.");
  }
  next();
}

/** requirePermission("issue:assign"): the role must hold that permission. Unknown permissions deny. */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user.role, permission)) {
      throw new AppError("FORBIDDEN", 403, "You don't have access to this.");
    }
    next();
  };
}

/** requireScope(req => ({ cityId })): the record being touched must be inside the user's scope. */
export function requireScope(getTarget) {
  return async (req, res, next) => {
    if (!inScope(req.user, await getTarget(req))) {
      throw new AppError("FORBIDDEN", 403, "You don't have access to this.");
    }
    next();
  };
}

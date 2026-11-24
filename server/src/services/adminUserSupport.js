// Shared helpers for adminUserService and mfaFlagService: errors, level rules, the serializer and
// the transaction wrapper. No HTTP here; controllers never see this file.
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";
import { can, levelOf } from "../utils/permissions.js";

export const trusted = mongoose.trusted; // lets our own $-operators through the global sanitizeFilter

/** Same body for "missing" and "out of your scope", so existence never leaks. */
export const notFound = () =>
  new AppError("NOT_FOUND", 404, "The requested resource was not found.");
export const forbidden = (message = "You don't have access to this.") =>
  new AppError("FORBIDDEN", 403, message);
export const conflict = () =>
  new AppError("CONFLICT", 409, "Someone else changed this user. Reload and try again.");

const sameId = (a, b) => a != null && b != null && String(a) === String(b);
export { sameId };

/**
 * Runs `work(session)` in one MongoDB transaction (needs a replica set). A lost optimistic-concurrency
 * race (VersionError) becomes 409 CONFLICT. mongoose retries transient transaction errors itself.
 */
export async function inTransaction(work) {
  try {
    return await mongoose.connection.transaction((session) => work(session));
  } catch (err) {
    if (err?.name === "VersionError") throw conflict();
    throw err;
  }
}

/** Level rules shared by role and status changes: not yourself, and only users strictly below you. */
export function assertManageable(actor, target) {
  if (sameId(actor.id, target._id)) throw forbidden("You can't change your own account.");
  if (levelOf(target.role) >= levelOf(actor.role)) throw forbidden("You can't change this user.");
}

/** Nobody grants a level equal to or above their own. */
export function assertAssignable(actor, newRole) {
  if (levelOf(newRole) === 0 || levelOf(newRole) >= levelOf(actor.role)) {
    throw forbidden("You can't assign that role.");
  }
}

// city_admin acts inside one city; the DB `cityId: null` would match every citizen, so refuse early.
export function assertActorScope(actor, permission) {
  if (!can(actor.role, permission)) throw forbidden();
  if (actor.role === "city_admin" && !actor.cityId) throw forbidden();
}

const CITY_ROLES_WITHOUT_ID = new Set(["citizen"]);

/** Can this actor change the target's role? (Computed server-side so the client copies no rules.) */
function canChangeRole(actor, target) {
  if (!can(actor.role, "user:promote") || sameId(actor.id, target._id)) return false;
  if (levelOf(target.role) >= levelOf(actor.role)) return false;
  if (actor.role === "super_admin") return true;
  return sameId(actor.cityId, target.cityId) || CITY_ROLES_WITHOUT_ID.has(target.role);
}

function canChangeStatus(actor, target) {
  if (!can(actor.role, "user:suspend") || sameId(actor.id, target._id)) return false;
  if (levelOf(target.role) >= levelOf(actor.role)) return false;
  return actor.role === "super_admin" || sameId(actor.cityId, target.cityId);
}

/** The shape admin endpoints return. Explicit picks, so `auth0Id` and internals never leak. */
export function serializeAdminUser(record, actor, names) {
  const idOrNull = (v) => (v ? String(v) : null);
  return {
    id: String(record._id),
    email: record.email,
    name: record.name ?? "",
    avatarUrl: record.avatarUrl ?? "",
    role: record.role,
    level: levelOf(record.role),
    cityId: idOrNull(record.cityId),
    departmentId: idOrNull(record.departmentId),
    cityName: names?.city(record.cityId) ?? null,
    departmentName: names?.department(record.departmentId) ?? null,
    stateCode: record.stateCode ?? null,
    status: record.status,
    suspendedReason: record.suspendedReason ?? null,
    emailVerified: Boolean(record.emailVerified),
    lastLoginAt: record.lastLoginAt ?? null,
    createdAt: record.createdAt,
    canManage: canChangeRole(actor, record), // role change
    canSuspend: canChangeStatus(actor, record), // suspend / reactivate
  };
}

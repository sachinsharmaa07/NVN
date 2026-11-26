// Admin rules for users: list, role change, suspend/reactivate, geo pickers. The service owns every
// rule; controllers only pass the actor (req.user), the validated input and request context.
import mongoose from "mongoose";
import { logger } from "../config/logger.js";
import { City } from "../models/City.js";
import { Department } from "../models/Department.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { clock } from "../utils/clock.js";
import { resolveScope, SCOPE_FIELDS } from "./adminUserScope.js";
import { lookupGeoNames } from "./geoNames.js";
import { escapeRegex } from "./adminUserList.js";
import { decodeNameCursor, encodeNameCursor } from "../utils/cursor.js";
import * as audit from "./auditService.js";
import {
  assertActorScope,
  assertAssignable,
  assertManageable,
  forbidden,
  inTransaction,
  notFound,
  sameId,
  serializeAdminUser,
} from "./adminUserSupport.js";
import { clearFlagBestEffort, requiresMfaFlag, setFlagOrThrow } from "./mfaFlagService.js";

export { listUsers } from "./adminUserList.js";
export { promoteToSuperAdmin, syncMfaFlags } from "./mfaFlagService.js";

const log = logger.child({ component: "adminUserService" });

/** PATCH /api/admin/users/:id/role. Rules: docs/phase-1-auth.md 7.1; Auth0 ordering: 7.2. */
export async function changeRole(actor, id, input, ctx = {}) {
  assertActorScope(actor, "user:promote");
  // Scope is part of the query: out-of-scope and missing both give the same 404.
  const scope =
    actor.role === "super_admin"
      ? { _id: id }
      : { _id: id, $or: [{ cityId: actor.cityId }, { role: "citizen" }] };
  const target = await User.findOne(scope).lean();
  if (!target) {
    (ctx.log ?? log).warn(
      { event: "authz.out_of_scope", actorId: actor.id, targetId: id },
      "Target not in scope",
    );
    throw notFound();
  }
  try {
    assertManageable(actor, target);
    assertAssignable(actor, input.role);
  } catch (err) {
    (ctx.log ?? log).warn({
      event: "admin.role_denied",
      actorId: actor.id,
      targetId: id,
      from: target.role,
      to: input.role,
    });
    throw err;
  }
  const next = await resolveScope(actor, target, input.role, input);
  const unchanged =
    target.role === input.role &&
    SCOPE_FIELDS.every((f) => String(target[f] ?? "") === (next[f] ?? ""));
  const nowMfa = requiresMfaFlag(input.role);
  const wasMfa = requiresMfaFlag(target.role);

  // Promotion to level >= 4: the flag first. If Auth0 is down nothing is written (extra MFA is harmless,
  // an admin without MFA is not). A same-role retry takes this path too, which is what makes it safe.
  if (nowMfa)
    await setFlagOrThrow(target.auth0Ids, true, { log: ctx.log, userId: String(target._id) });
  if (unchanged) {
    // No write and no audit row, but the flag is re-synced on purpose: a retry after a partial failure
    // (flag set, DB write lost) must heal it. Cost: one Auth0 call on a no-op, which is rare and admin-only.
    if (!nowMfa && wasMfa) await clearFlagBestEffort(target, actor, ctx);
    return { user: serializeAdminUser(target, actor, await lookupGeoNames([target])) };
  }

  let updated;
  try {
    updated = await inTransaction(async (session) => {
      const doc = await User.findOne(scope).session(session);
      if (!doc) throw notFound();
      // The actor decided on the version they saw; if it moved, they must look again.
      if (doc.__v !== target.__v)
        throw new AppError(
          "CONFLICT",
          409,
          "Someone else changed this user. Reload and try again.",
        );
      const before = {};
      const after = { role: input.role };
      before.role = doc.role;
      for (const f of SCOPE_FIELDS) {
        before[f] = doc[f] ? String(doc[f]) : undefined;
        after[f] = next[f] ?? null; // a cleared scope field is recorded as null, not dropped
      }
      doc.role = input.role;
      for (const f of SCOPE_FIELDS) doc[f] = next[f]; // undefined clears a field the new role forbids
      await doc.save({ session });
      await audit.record(
        {
          actorType: "user",
          actorId: actor.id,
          actorRole: actor.role,
          action: "user.role_change",
          targetId: doc._id,
          cityId: target.cityId, // the PRE-change city; the new one is in `after`
          before: changedOnly(before, after, true),
          after: changedOnly(before, after, false),
          reason: input.reason,
          ip: ctx.ip,
          requestId: ctx.requestId,
        },
        { session },
      );
      return doc.toObject();
    });
  } catch (err) {
    // The flag stays true: harmless (forces MFA enrolment); a retry completes the DB write.
    if (nowMfa && !wasMfa)
      (ctx.log ?? log).error({ event: "auth0.mfa_flag_orphan", userId: String(target._id) });
    throw err;
  }
  if (!nowMfa && wasMfa) await clearFlagBestEffort(target, actor, ctx);
  (ctx.log ?? log).warn({
    event: "admin.role_changed",
    actorId: actor.id,
    targetId: id,
    from: target.role,
    to: input.role,
  });
  return { user: serializeAdminUser(updated, actor, await lookupGeoNames([updated])) };
}

/** Keeps only keys whose value changed, for the audit before/after snapshots. */
function changedOnly(before, after, takeBefore) {
  const src = takeBefore ? before : after;
  return Object.fromEntries(
    Object.keys(src)
      .filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""))
      .map((k) => [k, src[k]]),
  );
}

/** PATCH /api/admin/users/:id/status: suspend or reactivate. Takes effect on the user's next request. */
export async function setStatus(actor, id, { status, reason }, ctx = {}) {
  assertActorScope(actor, "user:suspend");
  // A citizen is out of scope for a city_admin here (unlike promotion), so only the city matches.
  const scope = actor.role === "super_admin" ? { _id: id } : { _id: id, cityId: actor.cityId };
  const target = await User.findOne(scope).lean();
  if (!target) {
    (ctx.log ?? log).warn(
      { event: "authz.out_of_scope", actorId: actor.id, targetId: id },
      "Target not in scope",
    );
    throw notFound();
  }
  assertManageable(actor, target);
  if (target.status === status)
    return { user: serializeAdminUser(target, actor, await lookupGeoNames([target])) }; // no-op: no write, no audit

  const suspending = status === "suspended";
  const updated = await inTransaction(async (session) => {
    const doc = await User.findOne(scope).session(session);
    if (!doc) throw notFound();
    if (doc.__v !== target.__v)
      throw new AppError("CONFLICT", 409, "Someone else changed this user. Reload and try again.");
    const before = { status: doc.status, suspendedReason: doc.suspendedReason };
    doc.status = status;
    doc.suspendedReason = suspending ? reason : undefined;
    doc.suspendedAt = suspending ? clock.now() : undefined;
    doc.suspendedBy = suspending ? actor.id : undefined;
    await doc.save({ session });
    await audit.record(
      {
        actorType: "user",
        actorId: actor.id,
        actorRole: actor.role,
        action: suspending ? "user.suspend" : "user.reactivate",
        targetId: doc._id,
        cityId: doc.cityId,
        before,
        after: { status, suspendedReason: suspending ? reason : undefined },
        reason,
        ip: ctx.ip,
        requestId: ctx.requestId,
      },
      { session },
    );
    return doc.toObject();
  });
  (ctx.log ?? log).warn({
    event: "admin.status_changed",
    actorId: actor.id,
    targetId: id,
    to: status,
  });
  return { user: serializeAdminUser(updated, actor, await lookupGeoNames([updated])) };
}

const GEO_CAP = 500; // departments per city stay a small list; cities are paginated (637 and growing)

/**
 * GET /api/cities?stateCode=&q=&cursor=&limit=. A city_admin sees only their own city, a super_admin all.
 * Name order, keyset on (name, _id), backed by { name, _id } or { stateCode, name, _id }.
 */
export async function listCities(actor, { stateCode, q, cursor, limit = 20 }) {
  assertActorScope(actor, "user:promote");
  const filter = actor.role === "super_admin" ? {} : { _id: actor.cityId };
  if (stateCode) filter.stateCode = stateCode;
  // shortcut: case-insensitive prefix scans the whole name index (fine for ~700 cities); add a
  // lowercased name field if the list grows past a few thousand.
  const nameConds = [];
  if (q)
    nameConds.push({ name: mongoose.trusted({ $regex: `^${escapeRegex(q)}`, $options: "i" }) });
  if (cursor) {
    const after = decodeNameCursor(cursor);
    const id = new mongoose.Types.ObjectId(after._id);
    // trusted per operator: the global sanitizeFilter would turn each one into a literal match.
    nameConds.push({
      $or: [
        { name: mongoose.trusted({ $gt: after.name }) },
        { name: after.name, _id: mongoose.trusted({ $gt: id }) },
      ],
    });
  }
  if (nameConds.length) filter.$and = nameConds;
  const rows = await City.find(filter)
    .select("name code stateCode")
    .sort({ name: 1, _id: 1 })
    .limit(limit + 1)
    .lean();
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? encodeNameCursor(items[items.length - 1]) : null;
  return {
    items: items.map((c) => ({
      id: String(c._id),
      name: c.name,
      code: c.code,
      stateCode: c.stateCode,
    })),
    nextCursor,
  };
}

/** GET /api/departments?cityId=. A city_admin may only ask for their own city. */
export async function listDepartments(actor, { cityId }) {
  assertActorScope(actor, "user:promote");
  if (actor.role !== "super_admin" && !sameId(actor.cityId, cityId)) throw forbidden();
  return departmentsOf(cityId);
}

/** issue:assign holders without user:promote (dept_head), to assign triage: own city only, else 404. */
export async function listAssignableDepartments(actor, { cityId }) {
  if (!sameId(actor.cityId, cityId)) throw notFound();
  return departmentsOf(cityId);
}

async function departmentsOf(cityId) {
  const rows = await Department.find({ cityId })
    .select("name code")
    .sort({ name: 1 })
    .limit(GEO_CAP)
    .lean();
  return { items: rows.map((d) => ({ id: String(d._id), name: d.name, code: d.code })) };
}

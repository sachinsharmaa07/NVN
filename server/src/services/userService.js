// User records for the request pipeline and /api/me. Controllers and middleware call these;
// admin changes live in adminUserService.js.
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { logger } from "../config/logger.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { clock } from "../utils/clock.js";
import { levelOf, MFA_MIN_LEVEL, permissionsOf } from "../utils/permissions.js";
import { lookupGeoNames } from "./geoNames.js";
import { resendVerificationEmail } from "./authProviderService.js";

const log = logger.child({ component: "userService" });

// Custom claims our Auth0 post-login Action puts in the access token (docs/AUTH0_SETUP.md).
export const CLAIM_NAMESPACE = "https://nivaran.in/";

const REFRESH_AFTER_MS = 15 * 60 * 1000; // lastLoginAt/email/avatar are refreshed at most this often

/** Reads our claims from a verified token payload. Only `=== true` counts for email_verified and mfa. */
export function readClaims(payload) {
  // The subject is our identity key; anything but a short string is a broken token, not a user.
  if (typeof payload?.sub !== "string" || payload.sub.length < 1 || payload.sub.length > 128) {
    throw new AppError("UNAUTHENTICATED", 401, "Sign in to continue.");
  }
  // A claim that is not a string (a number, an object) counts as missing instead of reaching the database.
  const text = (value) => (typeof value === "string" ? value : undefined);
  return {
    auth0Id: payload.sub,
    email: text(payload[`${CLAIM_NAMESPACE}email`]),
    name: text(payload[`${CLAIM_NAMESPACE}name`]),
    picture: text(payload[`${CLAIM_NAMESPACE}picture`]),
    emailVerified: payload[`${CLAIM_NAMESPACE}email_verified`] === true,
    mfa: payload[`${CLAIM_NAMESPACE}mfa`] === true,
  };
}

const idOrNull = (v) => (v ? String(v) : null);

/** The user object routes see as req.user. Role, scope and status come from the database, never the token. */
export function toRequestUser(record, claims) {
  return {
    id: String(record._id),
    auth0Id: record.auth0Id,
    email: record.email,
    name: record.name ?? "",
    avatarUrl: record.avatarUrl ?? "",
    role: record.role,
    level: levelOf(record.role),
    cityId: idOrNull(record.cityId),
    departmentId: idOrNull(record.departmentId),
    stateCode: record.stateCode ?? null,
    status: record.status,
    suspendedReason: record.suspendedReason ?? null,
    preferredLanguage: record.preferredLanguage ?? "en",
    defaultPincode: record.defaultPincode ?? null,
    // The token is fresher than our stored copy, so it decides on every request.
    emailVerified: claims.emailVerified,
    mfa: claims.mfa,
  };
}

/** Adds cityName and departmentName to a public user (one batched lookup). */
export async function withGeoNames(user) {
  const names = await lookupGeoNames([user]);
  return {
    ...user,
    cityName: names.city(user.cityId),
    departmentName: names.department(user.departmentId),
  };
}

/** What GET /api/me returns. Picks fields one by one so a new internal field never leaks by accident. */
export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    level: levelOf(user.role),
    permissions: permissionsOf(user.role),
    cityId: user.cityId,
    departmentId: user.departmentId,
    stateCode: user.stateCode,
    status: user.status,
    emailVerified: user.emailVerified,
    preferredLanguage: user.preferredLanguage,
    defaultPincode: user.defaultPincode,
  };
}

// Defence in depth: the schema validates too, but upserts skip some validators, so clean values first.
const cleanEmail = (v) => (typeof v === "string" ? v.trim().toLowerCase().slice(0, 254) : "");
const cleanName = (v) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
const cleanAvatar = (v) =>
  typeof v === "string" && /^https:\/\//.test(v) && v.length <= 2048 ? v : "";

/** Creates the citizen on first sight. One atomic upsert, so parallel first requests make one user. */
async function createOnFirstSight(claims, now) {
  const email = cleanEmail(claims.email);
  if (!email) {
    throw new AppError(
      "TOKEN_CLAIMS_MISSING",
      401,
      "Your sign-in is missing details. Sign in again.",
    );
  }
  // $setOnInsert only: an existing row is never touched here, and role/status never come from claims.
  const update = {
    $setOnInsert: {
      email,
      emailVerified: claims.emailVerified,
      name: cleanName(claims.name),
      avatarUrl: cleanAvatar(claims.picture),
      role: "citizen",
      status: "active",
      preferredLanguage: "en",
      lastLoginAt: now,
    },
  };
  const options = {
    upsert: true,
    returnDocument: "after",
    lean: true,
    runValidators: true,
    includeResultMetadata: true,
  };
  let result;
  try {
    result = await User.findOneAndUpdate({ auth0Id: claims.auth0Id }, update, options);
  } catch (err) {
    // Lost the race with a parallel first request (duplicate auth0Id): the user exists now, so retry once.
    if (err?.code !== 11000) throw err;
    log.info({ event: "auth.jit_retry" }, "Retrying first-login upsert after duplicate key");
    result = await User.findOneAndUpdate({ auth0Id: claims.auth0Id }, update, options);
  }
  if (!result.lastErrorObject?.updatedExisting) {
    const emailHash = createHash("sha256").update(email).digest("hex").slice(0, 16);
    log.info(
      {
        event: "auth.jit_created",
        userId: String(result.value._id),
        auth0Id: claims.auth0Id,
        emailHash,
      },
      "Created citizen on first sign-in",
    );
  }
  return result.value;
}

/**
 * One conditional write that refreshes email, avatar, emailVerified and lastLoginAt when the stored
 * copy is older than 15 minutes, or when the token says verified and we do not yet. Racing requests:
 * one wins, the rest get null and keep the document they loaded.
 */
async function refreshIfStale(record, claims, now) {
  const cutoff = new Date(now.getTime() - REFRESH_AFTER_MS);
  const stale = !record.lastLoginAt || record.lastLoginAt < cutoff;
  const verifiedFlip = claims.emailVerified && !record.emailVerified;
  if (!stale && !verifiedFlip) return record;

  const triggers = [];
  if (stale) {
    // trusted(): the global sanitizeFilter would otherwise turn these operators into literal matches.
    triggers.push({ lastLoginAt: null }, { lastLoginAt: mongoose.trusted({ $lt: cutoff }) });
  }
  if (verifiedFlip) triggers.push({ emailVerified: false });

  const email = cleanEmail(claims.email);
  const set = { emailVerified: claims.emailVerified };
  if (stale) {
    set.lastLoginAt = now;
    if (email) set.email = email;
    const avatar = cleanAvatar(claims.picture);
    if (avatar) set.avatarUrl = avatar; // no picture claim must not wipe a good avatar
    // `name` is the user's to edit, so it is never overwritten
  }
  const updated = await User.findOneAndUpdate(
    { _id: record._id, status: "active", $or: triggers },
    { $set: set },
    { returnDocument: "after", lean: true, runValidators: true },
  );
  if (
    updated &&
    stale &&
    email &&
    email !== record.email &&
    levelOf(record.role) >= MFA_MIN_LEVEL
  ) {
    log.warn(
      { event: "auth.email_changed", userId: String(record._id) },
      "Privileged user's email changed",
    );
  }
  return updated ?? record;
}

/**
 * Turns verified token claims into req.user. A suspended user is returned untouched (requireActive
 * blocks them); only active users cause a write.
 */
export async function resolveRequestUser(claims) {
  const now = clock.now();
  let record = await User.findOne({ auth0Id: claims.auth0Id }).lean();
  if (!record) record = await createOnFirstSight(claims, now);
  else if (record.status === "active") record = await refreshIfStale(record, claims, now);
  return toRequestUser(record, claims);
}

/** PATCH /api/me. Only these three fields can change; null for the pincode clears it. */
export async function updateOwnProfile(userId, { name, preferredLanguage, defaultPincode }) {
  const set = {};
  const unset = {};
  if (name !== undefined) set.name = name;
  if (preferredLanguage !== undefined) set.preferredLanguage = preferredLanguage;
  if (defaultPincode === null) unset.defaultPincode = "";
  else if (defaultPincode !== undefined) set.defaultPincode = defaultPincode;

  const update = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;
  const record = await User.findOneAndUpdate({ _id: userId, status: "active" }, update, {
    returnDocument: "after",
    lean: true,
    runValidators: true,
  });
  if (!record) throw new AppError("NOT_FOUND", 404, "The requested resource was not found.");
  return {
    name: record.name,
    preferredLanguage: record.preferredLanguage,
    defaultPincode: record.defaultPincode ?? null,
  };
}

/** POST /api/me/resend-verification. The Auth0 user id comes from our record, never the request. */
export async function resendVerification(user, { log: reqLog } = {}) {
  if (user.emailVerified) {
    throw new AppError("ALREADY_VERIFIED", 409, "Your email is already verified.");
  }
  await resendVerificationEmail(user.auth0Id, { log: reqLog, userId: user.id });
}

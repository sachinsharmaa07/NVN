// User records. Controllers and middleware call these; only this file touches the User model.
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { levelOf } from "../utils/access.js";

// Custom claims our Auth0 post-login Action puts in the access token (docs/AUTH0_SETUP.md).
export const CLAIM_NAMESPACE = "https://nivaran.in/";

/** Reads our claims from a verified token payload. Only `=== true` counts as a verified email. */
export function readClaims(payload) {
  // A claim that is not a string (a number, an object) counts as missing instead of reaching the database.
  const text = (value) => (typeof value === "string" ? value : undefined);
  return {
    auth0Id: payload.sub,
    email: text(payload[`${CLAIM_NAMESPACE}email`]),
    name: text(payload[`${CLAIM_NAMESPACE}name`]),
    emailVerified: payload[`${CLAIM_NAMESPACE}email_verified`] === true,
  };
}

/** The user object routes see as req.user. Role and scope come from the database, never the token. */
export function toRequestUser(record, claims) {
  return {
    id: String(record._id),
    auth0Id: record.auth0Id,
    email: record.email,
    name: record.name,
    role: record.role,
    cityId: record.cityId ? String(record.cityId) : null,
    departmentId: record.departmentId ? String(record.departmentId) : null,
    // The token is fresher than our stored copy, so it decides on every request.
    emailVerified: claims.emailVerified,
  };
}

/** What GET /api/me returns. Picks fields one by one so a new internal field never leaks by accident. */
export function toPublicUser(user) {
  const { id, email, name, role, cityId, departmentId, emailVerified } = user;
  return { id, email, name, role, level: levelOf(role), cityId, departmentId, emailVerified };
}

export function assertActive(record) {
  if (record.status === "suspended") {
    throw new AppError("ACCOUNT_SUSPENDED", 403, "This account has been suspended.");
  }
}

export function findByAuth0Id(auth0Id) {
  return User.findOne({ auth0Id }).lean();
}

/**
 * First login creates a citizen; later logins refresh email, name and verified.
 * One atomic upsert, so two tabs logging in at once cannot create two users.
 */
export async function syncFromToken(claims) {
  if (!claims.email) {
    throw new AppError(
      "TOKEN_CLAIMS_MISSING",
      401,
      "Your sign-in is missing details. Sign in again.",
    );
  }
  const update = {
    $set: {
      email: claims.email,
      verified: claims.emailVerified,
      ...(claims.name && { name: claims.name }),
    },
    // Role and status are set only when the user is first created, never overwritten here.
    $setOnInsert: { role: "citizen", status: "active" },
  };
  // runValidators applies the schema limits (email 254, name 100 characters) to upserts too.
  const options = { upsert: true, returnDocument: "after", lean: true, runValidators: true };
  try {
    return await User.findOneAndUpdate({ auth0Id: claims.auth0Id }, update, options);
  } catch (err) {
    // Lost the race with a parallel first login (duplicate auth0Id): the user now exists, so retry once.
    if (err?.code !== 11000) throw err;
    return User.findOneAndUpdate({ auth0Id: claims.auth0Id }, update, options);
  }
}

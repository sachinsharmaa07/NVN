// Real MongoDB for API tests (a replica set, so transactions work), plus fixtures.
// Nothing here fakes the database: seeded users are written through the real models.
import { randomUUID } from "node:crypto";
import { inject, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../../src/config/db.js";
import { User } from "../../src/models/User.js";
import { AuditLog } from "../../src/models/AuditLog.js";
import { City } from "../../src/models/City.js";
import { Department } from "../../src/models/Department.js";
import { Pincode } from "../../src/models/Pincode.js";
import { Waitlist } from "../../src/models/Waitlist.js";
import { CategoryMapping } from "../../src/models/CategoryMapping.js";
import { signToken } from "./fakeAuth0.js";

/**
 * Call once at the top of an API test file. Connects, builds every index (the unique `auth0Ids`
 * and verified-email indexes are what the JIT race tests depend on) and empties all collections before each test.
 */
export function useTestDb() {
  beforeAll(async () => {
    const { uri, error } = inject("mongo");
    if (!uri) {
      throw new Error(
        `No test database. Set MONGODB_URI_TEST (database name ending _test) or let ` +
          `mongodb-memory-server start one. Reason: ${error}`,
      );
    }
    await connectDb(uri);
    // Defence in depth: whatever got us here, never wipe a database that is not a test one.
    if (!mongoose.connection.name.endsWith("_test")) {
      throw new Error(`Refusing to run against database "${mongoose.connection.name}"`);
    }
    await Promise.all(
      [User, AuditLog, City, Department, Pincode, Waitlist, CategoryMapping].map((m) => m.init()),
    );
  });
  beforeEach(wipeDb);
  afterAll(() => disconnectDb());
}

/** Empties every collection through the raw driver (the AuditLog hooks forbid deleting by design). */
export async function wipeDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

let counter = 0;

/** A small fixed geography: two cities in one state, one in another, and departments. */
export async function seedWorld() {
  const [cityA, cityB, cityC] = await City.create([
    { name: "Ludhiana", code: "LDH", stateCode: "PB" },
    { name: "Amritsar", code: "ASR", stateCode: "PB" },
    { name: "Pune", code: "PUN", stateCode: "MH" },
  ]);
  const [deptA1, deptA2, deptB1] = await Department.create([
    { cityId: cityA._id, name: "Roads", code: "ROADS" },
    { cityId: cityA._id, name: "Water", code: "WATER" },
    { cityId: cityB._id, name: "Roads", code: "ROADS" },
  ]);
  return { cityA, cityB, cityC, deptA1, deptA2, deptB1 };
}

/**
 * Inserts a user through the real model (so the scope rules run). `scope` is
 * { cityId, departmentId, stateCode } as the role needs; `extra` overrides any other field.
 * Returns the saved document.
 */
export async function seedUser(role = "citizen", scope = {}, extra = {}) {
  counter += 1;
  const tag = `${role}-${counter}`;
  return User.create({
    auth0Ids: [`auth0|${tag}-${randomUUID().slice(0, 8)}`],
    email: `${tag}@example.com`,
    emailVerified: true,
    name: `Test ${tag}`,
    role,
    // Recent, so the first request does not trigger the 15-minute refresh write; pass null to test that.
    lastLoginAt: new Date(),
    ...scope,
    ...extra,
  });
}

/**
 * A valid token for a seeded user: the `sub` and email match the row. Pass `claims` to change what
 * the token says (e.g. `{ mfa: true }`, `{ email_verified: false }`). Admin-level tests pass
 * `mfa: true` by default, because the server fails closed without it.
 */
export function tokenFor(user, claims = {}) {
  return signToken({
    sub: user.auth0Ids[0],
    email: user.email,
    name: user.name,
    email_verified: user.emailVerified,
    mfa:
      (user.role &&
        ["dept_head", "city_admin", "state_officer", "super_admin"].includes(user.role)) ||
      undefined,
    ...claims,
  });
}

/** Writes straight through the driver, past the Mongoose hooks: simulates "someone changed the DB". */
export async function rawUpdate(user, set, unset = {}) {
  const update = { $set: set };
  if (Object.keys(unset).length) update.$unset = unset;
  await User.collection.updateOne({ _id: user._id }, update);
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

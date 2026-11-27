// One-off data migrations. v1: Phase 1 (`verified` -> `emailVerified`, status default, new indexes).
// v2: auth0Id -> auth0Ids, v3: remove the leftover auth0Id. M1: pincode, waitlist, city and department indexes. All idempotent;
// called only by the matching scripts/migrate*.js.
import { AuditLog } from "../models/AuditLog.js";
import { City } from "../models/City.js";
import { Department } from "../models/Department.js";
import { CategoryMapping } from "../models/CategoryMapping.js";
import { Pincode } from "../models/Pincode.js";
import { Waitlist } from "../models/Waitlist.js";
import { Issue } from "../models/Issue.js";
import { SlaPolicy } from "../models/SlaPolicy.js";
import { User } from "../models/User.js";
import { SCOPE_RULES } from "../utils/permissions.js";

const SCOPE_FIELDS = ["cityId", "departmentId", "stateCode"];
// Indexes the old schema built that the new one replaces (names as MongoDB generated them).
const OLD_INDEXES = ["cityId_1_role_1", "departmentId_1_role_1_createdAt_-1__id_-1"];
// City index replaced by { stateCode, name, _id } for keyset paging (5b785cb); nothing queries it now.
const OLD_M1_CITY_INDEXES = ["stateCode_1_name_1"];

/** Pure: why a stored user row breaks SCOPE_RULES (or has an unknown role). [] when it is fine. */
export function scopeViolations(row) {
  const rule = SCOPE_RULES[row.role];
  if (!rule) return [`unknown role ${row.role}`];
  return SCOPE_FIELDS.flatMap((f) => {
    const isSet = row[f] != null;
    if (rule[f] === "R" && !isSet) return [`${f} missing for ${row.role}`];
    if (rule[f] === "F" && isSet) return [`${f} not allowed for ${row.role}`];
    return [];
  });
}

export async function dropIndexIfPresent(collection, name) {
  try {
    await collection.dropIndex(name);
    return true;
  } catch (err) {
    if (err?.codeName === "IndexNotFound" || err?.codeName === "NamespaceNotFound") return false;
    throw err;
  }
}

export async function hasIndex(collection, name) {
  try {
    return (await collection.indexes()).some((i) => i.name === name);
  } catch (err) {
    if (err?.codeName === "NamespaceNotFound") return false;
    throw err;
  }
}

/** Runs every step and returns what changed. Raw collection calls: Mongoose's write guard is for app code. */
export async function migrateUsersV1() {
  const report = {
    renamed: 0,
    leftoverVerifiedRemoved: 0,
    statusSet: 0,
    droppedIndexes: [],
    violations: [],
  };

  // verified -> emailVerified, only where the new field is not already there.
  const rename = await User.collection.updateMany(
    { verified: { $exists: true }, emailVerified: { $exists: false } },
    { $rename: { verified: "emailVerified" } },
  );
  report.renamed = rename.modifiedCount;
  // Rows that somehow have both: the new field wins, the old one goes.
  const leftover = await User.collection.updateMany(
    { verified: { $exists: true } },
    { $unset: { verified: "" } },
  );
  report.leftoverVerifiedRemoved = leftover.modifiedCount;
  const noStatus = await User.collection.updateMany(
    { status: { $exists: false } },
    { $set: { status: "active" } },
  );
  report.statusSet = noStatus.modifiedCount;
  await User.collection.updateMany(
    { emailVerified: { $exists: false } },
    { $set: { emailVerified: false } },
  );

  // Report (never fix) rows that break the scope rules: a human decides what those users should be.
  for await (const row of User.find({}, { role: 1, cityId: 1, departmentId: 1, stateCode: 1 })
    .lean()
    .cursor()) {
    const problems = scopeViolations(row);
    if (problems.length > 0) report.violations.push({ id: String(row._id), problems });
  }

  for (const name of OLD_INDEXES)
    if (await dropIndexIfPresent(User.collection, name)) report.droppedIndexes.push(name);
  // createIndexes (not syncIndexes) so nothing we did not name is ever dropped. Production runs with
  // autoIndex off, so this is where its indexes get built.
  for (const model of [User, AuditLog, City, Department]) await model.createIndexes();
  return report;
}

/**
 * auth0Id -> auth0Ids (copy; the old field stays for rollback). Dry run unless `apply`. Stops, writing
 * nothing, when two rows share a verified email: the new unique index could not be built, and a human
 * must decide which row is the real account. Idempotent. Called only by scripts/migrateUsersV2.js.
 */
export async function migrateUsersV2({ apply = false } = {}) {
  const duplicates = await User.collection
    .aggregate([
      { $match: { emailVerified: true } },
      { $group: { _id: "$email", ids: { $push: "$_id" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $limit: 50 },
    ])
    .toArray();
  const report = {
    applied: false,
    duplicates: duplicates.map((d) => d.ids.map(String)), // ids only: emails stay out of the output
    toCopy: 0,
    droppedIndexes: [],
  };
  if (duplicates.length > 0) return report;

  const pending = { auth0Id: { $exists: true }, auth0Ids: { $exists: false } };
  report.toCopy = await User.collection.countDocuments(pending);
  if (!apply) return report;

  await User.collection.updateMany(pending, [{ $set: { auth0Ids: ["$auth0Id"] } }]);
  // The old unique index would see every new row (no auth0Id) as a duplicate null.
  if (await dropIndexIfPresent(User.collection, "auth0Id_1"))
    report.droppedIndexes.push("auth0Id_1");
  await User.createIndexes();
  report.applied = true;
  return report;
}

/**
 * Removes the old `auth0Id` field that migrateUsersV2 kept for rollback, only where its value is already in
 * `auth0Ids` (so nothing can be lost). Rows not yet copied are counted and left alone: run v2 first.
 * Dry run unless `apply`. Idempotent. Called only by scripts/migrateUsersV3.js.
 */
export async function migrateUsersV3({ apply = false } = {}) {
  // Raw driver filters: the schema no longer declares auth0Id, so Mongoose would strip it.
  const copied = {
    auth0Id: { $exists: true },
    $expr: { $in: ["$auth0Id", { $ifNull: ["$auth0Ids", []] }] },
  };
  const notCopied = {
    auth0Id: { $exists: true },
    $expr: { $not: { $in: ["$auth0Id", { $ifNull: ["$auth0Ids", []] }] } },
  };
  const report = {
    applied: false,
    toRemove: await User.collection.countDocuments(copied),
    notCopied: await User.collection.countDocuments(notCopied),
  };
  if (!apply) return report;
  await User.collection.updateMany(copied, { $unset: { auth0Id: "" } });
  report.applied = true;
  return report;
}

/**
 * M1: builds the declared indexes of Pincode, Waitlist, City, Department, CategoryMapping, SlaPolicy and Issue (production runs with
 * autoIndex off) and gives cities without a `status` the default "onboarding". Dry run unless
 * `apply`: reports index names that are missing, stale city indexes, and how many cities would change.
 * Drops only the stale indexes named in OLD_M1_CITY_INDEXES, after their replacements are built.
 */
export async function migrateM1Indexes({ apply = false } = {}) {
  const report = { applied: false, missingIndexes: {}, citiesWithoutStatus: 0, staleIndexes: [] };
  for (const model of M1_MODELS) {
    // diffIndexes lists what createIndexes would build; a missing collection has none yet.
    const { toCreate } = await model.diffIndexes();
    if (toCreate.length) report.missingIndexes[model.modelName] = toCreate.map(indexName);
  }
  const noStatus = { status: { $exists: false } };
  report.citiesWithoutStatus = await City.collection.countDocuments(noStatus);
  for (const name of OLD_M1_CITY_INDEXES)
    if (await hasIndex(City.collection, name)) report.staleIndexes.push(name);
  if (!apply) return report;

  for (const model of M1_MODELS) await model.createIndexes();
  await City.collection.updateMany(noStatus, { $set: { status: "onboarding" } });
  for (const name of report.staleIndexes) await dropIndexIfPresent(City.collection, name);
  report.applied = true;
  return report;
}

const M1_MODELS = [Pincode, Waitlist, City, Department, CategoryMapping, SlaPolicy, Issue];

// diffIndexes returns key objects ({ pin: 1 }); print them the way MongoDB names them (pin_1).
export const indexName = (keys) =>
  Object.entries(keys)
    .map(([field, dir]) => `${field}_${dir}`)
    .join("_");

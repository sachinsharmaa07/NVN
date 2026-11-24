// One-off data migration for Phase 1 (`verified` -> `emailVerified`, status default, new indexes).
// Idempotent: a second run changes nothing and says so. Called only by scripts/migrateUsersV1.js.
import { AuditLog } from "../models/AuditLog.js";
import { City } from "../models/City.js";
import { Department } from "../models/Department.js";
import { User } from "../models/User.js";
import { SCOPE_RULES } from "../utils/permissions.js";

const SCOPE_FIELDS = ["cityId", "departmentId", "stateCode"];
// Indexes the old schema built that the new one replaces (names as MongoDB generated them).
const OLD_INDEXES = ["cityId_1_role_1", "departmentId_1_role_1_createdAt_-1__id_-1"];

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

async function dropIndexIfPresent(name) {
  try {
    await User.collection.dropIndex(name);
    return true;
  } catch (err) {
    if (err?.codeName === "IndexNotFound" || err?.codeName === "NamespaceNotFound") return false;
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
    if (await dropIndexIfPresent(name)) report.droppedIndexes.push(name);
  // createIndexes (not syncIndexes) so nothing we did not name is ever dropped. Production runs with
  // autoIndex off, so this is where its indexes get built.
  for (const model of [User, AuditLog, City, Department]) await model.createIndexes();
  return report;
}

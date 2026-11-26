// Decision M1-9: gives every city the default departments and category map. Called only by
// scripts/seedDepartments.js. Inserts only what is missing ($setOnInsert), so it never overwrites a
// department name or a mapping an admin changed, and a rerun creates 0.
import mongoose from "mongoose";
import { City } from "../models/City.js";
import { Department } from "../models/Department.js";
import { CategoryMapping } from "../models/CategoryMapping.js";
import { DEFAULT_DEPARTMENTS, DEFAULT_MAPPING } from "../utils/categories.js";

const BATCH = 500;
const key = (cityId, x) => `${cityId}:${x}`;

async function seedBatch(cityIds, apply, report) {
  const inIds = mongoose.trusted({ $in: cityIds });
  const depts = await Department.find({ cityId: inIds }, "cityId code").lean();
  const deptId = new Map(depts.map((d) => [key(d.cityId, d.code), d._id]));
  const deptOps = [];
  for (const cityId of cityIds) {
    for (const { code, name } of DEFAULT_DEPARTMENTS) {
      if (deptId.has(key(cityId, code))) continue;
      deptOps.push({
        updateOne: { filter: { cityId, code }, update: { $setOnInsert: { name } }, upsert: true },
      });
    }
  }
  report.departmentsCreated += deptOps.length;
  if (apply && deptOps.length) {
    await Department.bulkWrite(deptOps, { ordered: false });
    for (const d of await Department.find({ cityId: inIds }, "cityId code").lean()) {
      deptId.set(key(d.cityId, d.code), d._id);
    }
  }

  const mapped = await CategoryMapping.find({ cityId: inIds }, "cityId category").lean();
  const have = new Set(mapped.map((m) => key(m.cityId, m.category)));
  const mapOps = [];
  for (const cityId of cityIds) {
    for (const [category, code] of Object.entries(DEFAULT_MAPPING)) {
      if (have.has(key(cityId, category))) continue;
      const departmentId = code ? (deptId.get(key(cityId, code)) ?? null) : null;
      // Dry run: the department does not exist yet, but the mapping would still be created.
      if (apply && code && !departmentId)
        throw new Error(`No ${code} department for city ${cityId}`);
      mapOps.push({
        updateOne: {
          filter: { cityId, category },
          update: { $setOnInsert: { departmentId, queue: code ? "department" : "triage" } },
          upsert: true,
        },
      });
    }
  }
  report.mappingsCreated += mapOps.length;
  if (apply && mapOps.length) await CategoryMapping.bulkWrite(mapOps, { ordered: false });
}

/** Dry run unless `apply`. `cityCode` limits it to one city. Returns counts of what was (or would be) created. */
export async function seedDepartments({ apply = false, cityCode } = {}) {
  const ids = (
    await City.find(cityCode ? { code: cityCode } : {}, "_id")
      .sort({ _id: 1 })
      .lean()
  ).map((c) => c._id);
  if (cityCode && ids.length === 0) throw new Error(`No city ${cityCode}`);
  const report = { applied: apply, cities: ids.length, departmentsCreated: 0, mappingsCreated: 0 };
  for (let i = 0; i < ids.length; i += BATCH)
    await seedBatch(ids.slice(i, i + BATCH), apply, report);
  return report;
}

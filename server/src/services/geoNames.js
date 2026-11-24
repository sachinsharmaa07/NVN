// The global sanitizeFilter would turn a bare $in into a literal match, hence trusted().
// Resolves city and department ids to display names with at most two queries per response.
import mongoose from "mongoose";
import { City } from "../models/City.js";
import { Department } from "../models/Department.js";

/** records: anything with cityId / departmentId. Returns { city(id), department(id) } name lookups. */
export async function lookupGeoNames(records) {
  const ids = (field) => [
    ...new Set(
      records
        .map((r) => r[field])
        .filter(Boolean)
        .map(String),
    ),
  ];
  const [cityIds, departmentIds] = [ids("cityId"), ids("departmentId")];
  const [cities, departments] = await Promise.all([
    cityIds.length
      ? City.find({ _id: mongoose.trusted({ $in: cityIds }) }, { name: 1 }).lean()
      : [],
    departmentIds.length
      ? Department.find({ _id: mongoose.trusted({ $in: departmentIds }) }, { name: 1 }).lean()
      : [],
  ]);
  const cityNames = new Map(cities.map((c) => [String(c._id), c.name]));
  const departmentNames = new Map(departments.map((d) => [String(d._id), d.name]));
  return {
    city: (id) => (id ? (cityNames.get(String(id)) ?? null) : null),
    department: (id) => (id ? (departmentNames.get(String(id)) ?? null) : null),
  };
}

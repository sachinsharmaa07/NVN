// seed:departments on a real database: default departments and category map per city, dry run writes
// nothing, a rerun creates 0, and an admin's changes survive a rerun.
import { describe, it, expect, beforeEach } from "vitest";
import { useTestDb } from "../helpers/testDb.js";
import { City } from "../../src/models/City.js";
import { Department } from "../../src/models/Department.js";
import { CategoryMapping } from "../../src/models/CategoryMapping.js";
import { seedDepartments } from "../../src/services/departmentSeedService.js";

useTestDb();

let kapurthala;
let jalandhar;
beforeEach(async () => {
  [kapurthala, jalandhar] = await City.create([
    { name: "Kapurthala", code: "PB-KAPURTHALA", stateCode: "PB", status: "active" },
    { name: "Jalandhar", code: "PB-JALANDHAR", stateCode: "PB", status: "active" },
  ]);
});

const mapOf = async (city) => {
  const rows = await CategoryMapping.find({ cityId: city._id })
    .populate("departmentId", "code")
    .lean();
  return Object.fromEntries(rows.map((m) => [m.category, m.departmentId?.code ?? m.queue]));
};

describe("seedDepartments", () => {
  it("dry run counts and writes nothing", async () => {
    expect(await seedDepartments()).toEqual({
      applied: false,
      cities: 2,
      departmentsCreated: 10,
      mappingsCreated: 12,
    });
    expect(await Department.countDocuments()).toBe(0);
    expect(await CategoryMapping.countDocuments()).toBe(0);
  });

  it("--apply creates 5 departments and the 6-category map per city; a rerun creates 0", async () => {
    expect(await seedDepartments({ apply: true })).toMatchObject({
      departmentsCreated: 10,
      mappingsCreated: 12,
    });
    const names = (await Department.find({ cityId: kapurthala._id }).sort({ code: 1 }).lean()).map(
      (d) => d.name,
    );
    expect(names).toEqual(["Drainage", "Electrical", "Roads", "Sanitation", "Water"]);
    expect(await mapOf(kapurthala)).toEqual({
      pothole: "ROADS",
      garbage: "SANITATION",
      streetlight: "ELECTRICAL",
      water_leak: "WATER",
      drainage: "DRAINAGE",
      other: "triage",
    });
    const other = await CategoryMapping.findOne({
      cityId: jalandhar._id,
      category: "other",
    }).lean();
    expect(other).toMatchObject({ departmentId: null, queue: "triage" });

    const before = await CategoryMapping.find().sort({ _id: 1 }).lean();
    expect(await seedDepartments({ apply: true })).toMatchObject({
      departmentsCreated: 0,
      mappingsCreated: 0,
    });
    expect(await CategoryMapping.find().sort({ _id: 1 }).lean()).toEqual(before);
  });

  it("keeps an existing department and an admin's mapping change; fills in only what is missing", async () => {
    const roads = await Department.create({
      cityId: kapurthala._id,
      code: "ROADS",
      name: "PWD Roads",
    });
    const water = await Department.create({
      cityId: kapurthala._id,
      code: "JALBOARD",
      name: "Jal Board",
    });
    await CategoryMapping.create({
      cityId: kapurthala._id,
      category: "water_leak",
      departmentId: water._id,
      queue: "department",
    });

    const r = await seedDepartments({ apply: true, cityCode: "PB-KAPURTHALA" });
    expect(r).toMatchObject({ cities: 1, departmentsCreated: 4, mappingsCreated: 5 });
    expect((await Department.findById(roads._id).lean()).name).toBe("PWD Roads");
    expect((await mapOf(kapurthala)).water_leak).toBe("JALBOARD");
    expect(await Department.countDocuments({ cityId: jalandhar._id })).toBe(0); // --city filter
    await expect(seedDepartments({ cityCode: "XX-NOWHERE" })).rejects.toThrow(/No city/);
  });

  it("a mapped department cannot be deleted", async () => {
    await seedDepartments({ apply: true });
    const roads = await Department.findOne({ cityId: kapurthala._id, code: "ROADS" });
    await expect(Department.deleteOne({ _id: roads._id })).rejects.toThrow(/category mappings/);
  });
});

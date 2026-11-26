// migrate:m1-indexes on a real database: dry run reports and writes nothing, --apply builds the
// indexes and backfills city status, a rerun is a no-op. Also the City delete guard for pincodes.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useTestDb } from "../helpers/testDb.js";
import { City } from "../../src/models/City.js";
import { Pincode } from "../../src/models/Pincode.js";
import { Waitlist } from "../../src/models/Waitlist.js";
import { migrateM1Indexes } from "../../src/services/migrationService.js";

useTestDb();

const names = async (model) => (await model.collection.indexes()).map((i) => i.name);

describe("migrateM1Indexes", () => {
  beforeEach(async () => {
    for (const model of [Pincode, Waitlist]) await model.collection.dropIndexes();
  });
  afterEach(async () => {
    for (const model of [Pincode, Waitlist]) await model.createIndexes();
  });

  it("dry run lists missing indexes; --apply builds them and sets city status; rerun is a no-op", async () => {
    await City.collection.insertOne({ name: "Phagwara", code: "PHG", stateCode: "PB" });

    const dry = await migrateM1Indexes();
    expect(dry.applied).toBe(false);
    expect(dry.missingIndexes.Pincode).toEqual(
      expect.arrayContaining(["pin_1", "boundary_2dsphere", "cityId_1_isServed_1"]),
    );
    expect(dry.missingIndexes.Waitlist).toEqual(["pin_1_emailHash_1"]);
    expect(dry.citiesWithoutStatus).toBe(1);
    expect(await names(Pincode)).toEqual(["_id_"]);

    expect(await migrateM1Indexes({ apply: true })).toMatchObject({ applied: true });
    expect(await names(Pincode)).toEqual(
      expect.arrayContaining(["pin_1", "boundary_2dsphere", "cityId_1_isServed_1"]),
    );
    expect((await City.findOne({ code: "PHG" }).lean()).status).toBe("onboarding");

    expect(await migrateM1Indexes({ apply: true })).toEqual({
      applied: true,
      missingIndexes: {},
      citiesWithoutStatus: 0,
      staleIndexes: [],
    });
  });

  it("dry run reports the old { stateCode, name } city index; --apply drops it after building its replacement", async () => {
    await City.collection.createIndex({ stateCode: 1, name: 1 });

    expect((await migrateM1Indexes()).staleIndexes).toEqual(["stateCode_1_name_1"]);
    expect(await names(City)).toContain("stateCode_1_name_1");

    expect((await migrateM1Indexes({ apply: true })).staleIndexes).toEqual(["stateCode_1_name_1"]);
    expect(await names(City)).not.toContain("stateCode_1_name_1");
    expect(await names(City)).toContain("stateCode_1_name_1__id_1");

    expect((await migrateM1Indexes({ apply: true })).staleIndexes).toEqual([]);
  });
});

describe("pincodes with the indexes built", () => {
  it("stores many pincodes without a boundary (2dsphere skips them) and one pin only once", async () => {
    await Pincode.create([
      { pin: "144401", district: "Kapurthala", state: "Punjab" },
      { pin: "144402", district: "Kapurthala", state: "Punjab" },
    ]);
    await expect(
      Pincode.create({ pin: "144401", district: "Kapurthala", state: "Punjab" }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("refuses to delete a city that pincodes still point at", async () => {
    const city = await City.create({ name: "Phagwara", code: "PHG", stateCode: "PB" });
    await Pincode.create({
      pin: "144401",
      district: "Kapurthala",
      state: "Punjab",
      cityId: city._id,
    });
    await expect(City.deleteOne({ _id: city._id })).rejects.toThrow(/pincodes/);
  });
});

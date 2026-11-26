// Pincode and boundary import on a real database, with the 20-row CSV and 2-feature GeoJSON fixtures:
// dry run writes nothing, --apply writes, and a second --apply changes 0 documents.
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/testDb.js";
import { City } from "../../src/models/City.js";
import { Pincode } from "../../src/models/Pincode.js";
import { importPincodes } from "../../src/services/pincodeImportService.js";
import { importBoundaries } from "../../src/services/boundaryImportService.js";

useTestDb();

const fixture = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const csv = () => createReadStream(fixture("pincodes.csv"));
const geojson = async () => JSON.parse(await readFile(fixture("phagwara.geojson"), "utf8"));
const loadPhagwara = () => importPincodes({ input: csv(), apply: true, cityCode: "PHG" });

describe("importPincodes", () => {
  it("dry run counts and writes nothing", async () => {
    const r = await importPincodes({ input: csv(), cityCode: "PHG" });
    expect(r).toMatchObject({ applied: false, rows: 20, badRows: 2, pincodes: 13, inserted: 13 });
    expect(r.missingCityPins).toEqual(["144409"]);
    expect(await Pincode.countDocuments()).toBe(0);
    expect(await City.countDocuments()).toBe(0);
  });

  it("--apply groups offices per pincode, marks the pilot served; a rerun changes 0", async () => {
    expect(await loadPhagwara()).toMatchObject({ inserted: 13, updated: 0, unchanged: 0 });

    const city = await City.findOne({ code: "PHG" }).lean();
    expect(city).toMatchObject({ name: "Phagwara", stateCode: "PB", status: "active" });
    const p = await Pincode.findOne({ pin: "144401" }).lean();
    expect(p).toMatchObject({
      district: "KAPURTHALA",
      state: "PUNJAB",
      isServed: true,
      boundarySource: "none",
    });
    expect(p.cityId).toEqual(city._id);
    expect(p.localities).toEqual(["Bhagatpura, Phagwara B.O", "Phagwara H.O", "Phagwara Town S.O"]);
    const delhi = await Pincode.findOne({ pin: "110001" }).lean();
    expect(delhi).toMatchObject({ isServed: false, cityId: null });
    expect(await Pincode.countDocuments({ isServed: true })).toBe(10);

    const before = await Pincode.find().sort({ pin: 1 }).lean();
    expect(await loadPhagwara()).toMatchObject({ inserted: 0, updated: 0, unchanged: 13 });
    // Without --city a rerun keeps the served flags it does not know about.
    expect(await importPincodes({ input: csv(), apply: true })).toMatchObject({ updated: 0 });
    expect(await Pincode.find().sort({ pin: 1 }).lean()).toEqual(before);
  });

  it("refuses an unknown city and a CSV without the needed columns", async () => {
    await expect(importPincodes({ input: csv(), cityCode: "XXX" })).rejects.toThrow(/Unknown city/);
    const { Readable } = await import("node:stream");
    await expect(importPincodes({ input: Readable.from(["a,b\n1,2\n"]) })).rejects.toThrow(
      /missing/,
    );
  });
});

describe("importBoundaries", () => {
  it("sets boundary, source and centroid; a rerun changes 0; reports gaps", async () => {
    await loadPhagwara();
    const dry = await importBoundaries({ geojson: await geojson() });
    expect(dry).toMatchObject({
      applied: false,
      features: 2,
      updated: 2,
      invalid: [],
      unmatched: [],
    });
    expect(await Pincode.countDocuments({ boundarySource: "manual" })).toBe(0);

    const r = await importBoundaries({ geojson: await geojson(), apply: true });
    expect(r).toMatchObject({ updated: 2, unchanged: 0, invalid: [] });
    expect(r.servedWithoutBoundary).toEqual([
      "144403",
      "144404",
      "144405",
      "144406",
      "144407",
      "144408",
      "144410",
      "144411",
    ]);
    const p = await Pincode.findOne({ pin: "144401" }).lean();
    expect(p).toMatchObject({ boundarySource: "manual", boundary: { type: "Polygon" } });
    expect(p.centroid).toEqual({ type: "Point", coordinates: [75.775, 31.225] });

    const before = await Pincode.find().sort({ pin: 1 }).lean();
    expect(await importBoundaries({ geojson: await geojson(), apply: true })).toMatchObject({
      updated: 0,
      unchanged: 2,
    });
    expect(await Pincode.find().sort({ pin: 1 }).lean()).toEqual(before);

    // The 2dsphere index answers "which pincode contains this point".
    const hit = await Pincode.findOne({
      boundary: mongoose.trusted({
        $geoIntersects: { $geometry: { type: "Point", coordinates: [75.8, 31.22] } },
      }),
    });
    expect(hit.pin).toBe("144402");
  });

  it("reports invalid and unmatched features without writing them", async () => {
    await loadPhagwara();
    const ring = [
      [75.7, 31.2],
      [75.71, 31.2],
      [75.71, 31.21],
      [75.7, 31.2],
    ];
    const geo = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { pincode: "144403" },
          geometry: { type: "Polygon", coordinates: [ring.slice(0, 3)] },
        },
        {
          type: "Feature",
          properties: { pin: "999999" },
          geometry: { type: "Polygon", coordinates: [ring] },
        },
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } },
      ],
    };
    const r = await importBoundaries({ geojson: geo, apply: true });
    expect(r.invalid.map((x) => x.pin)).toEqual(["144403", ""]);
    expect(r.unmatched).toEqual(["999999"]);
    expect(r.updated).toBe(0);
  });
});

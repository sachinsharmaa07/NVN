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
const tsv = () => createReadStream(fixture("pincodes.tsv"));
const csv = () => createReadStream(fixture("pincodes.csv"));
const geojson = async () => JSON.parse(await readFile(fixture("phagwara.geojson"), "utf8"));
const loadIndia = () => importPincodes({ input: tsv(), apply: true });
const snapshot = async () => ({
  pincodes: await Pincode.find().sort({ pin: 1 }).lean(),
  cities: await City.find().sort({ code: 1 }).lean(),
});

describe("importPincodes --format geonames", () => {
  it("dry run counts and writes nothing", async () => {
    const r = await importPincodes({ input: tsv() });
    expect(r).toMatchObject({ applied: false, rows: 20, badRows: 2, pincodes: 9, inserted: 9 });
    expect(r).toMatchObject({ citiesCreated: 5, unknownStates: ["Atlantis"] });
    expect(await Pincode.countDocuments()).toBe(0);
    expect(await City.countDocuments()).toBe(0);
  });

  it("--apply: district cities, places, mean centre, radius, served; a rerun changes 0", async () => {
    const r = await loadIndia();
    expect(r).toMatchObject({ citiesCreated: 5, inserted: 9, updated: 0, unchanged: 0 });

    const codes = (await City.find().sort({ code: 1 }).lean()).map((c) => [
      c.code,
      c.name,
      c.status,
    ]);
    expect(codes).toEqual([
      ["AN-NICOBAR", "Nicobar", "active"],
      ["DL-NEW-DELHI", "New Delhi", "active"],
      ["JK-SRINAGAR", "Srinagar", "active"],
      ["PB-JALANDHAR", "Jalandhar", "active"],
      ["PB-KAPURTHALA", "Kapurthala", "active"],
    ]);
    const kapurthala = await City.findOne({ code: "PB-KAPURTHALA" }).lean();
    const p = await Pincode.findOne({ pin: "144401" }).lean();
    expect(p).toMatchObject({
      district: "Kapurthala",
      state: "Punjab",
      isServed: true,
      radiusM: 3000,
    });
    expect(p.cityId).toEqual(kapurthala._id);
    expect(p.localities).toEqual(["Bhagatpura", "Phagwara", "Phagwara Town"]);
    expect(p.centroid).toEqual({ type: "Point", coordinates: [75.7752, 31.2235] });
    expect((await Pincode.findOne({ pin: "144402" }).lean()).radiusM).toBe(3774);
    expect((await Pincode.findOne({ pin: "744301" }).lean()).radiusM).toBe(25000); // clamped
    // 144411 has two Kapurthala places and one Jalandhar place: the most common district wins.
    expect((await Pincode.findOne({ pin: "144411" }).lean()).cityId).toEqual(kapurthala._id);
    expect(await Pincode.countDocuments({ isServed: true })).toBe(9);

    const before = await snapshot();
    expect(await loadIndia()).toMatchObject({
      citiesCreated: 0,
      citiesUpdated: 0,
      inserted: 0,
      updated: 0,
      unchanged: 9,
    });
    expect(await snapshot()).toEqual(before);
  });

  it("--city filters to one district city", async () => {
    const r = await importPincodes({ input: tsv(), apply: true, cityCode: "PB-JALANDHAR" });
    expect(r).toMatchObject({ pincodes: 2, citiesCreated: 1, inserted: 2 });
    expect((await Pincode.find().sort({ pin: 1 }).lean()).map((p) => p.pin)).toEqual([
      "144001",
      "144005",
    ]);
    await expect(importPincodes({ input: tsv(), cityCode: "XX-NOWHERE" })).rejects.toThrow(
      /No pincodes/,
    );
  });

  it("keeps an admin's city status and a polygon's centroid on a rerun", async () => {
    await loadIndia();
    await City.updateOne({ code: "PB-KAPURTHALA" }, { status: "onboarding" });
    await importBoundaries({ geojson: await geojson(), apply: true });
    const before = await snapshot();
    expect(await loadIndia()).toMatchObject({ updated: 0, citiesUpdated: 0 });
    expect(await snapshot()).toEqual(before);
  });
});

describe("importPincodes --format csv", () => {
  it("imports places and district cities but never marks a pincode served (no coordinates)", async () => {
    const r = await importPincodes({ input: csv(), format: "csv", apply: true });
    expect(r).toMatchObject({ rows: 20, badRows: 2, pincodes: 13, inserted: 13 });
    const p = await Pincode.findOne({ pin: "144401" }).lean();
    expect(p).toMatchObject({ district: "KAPURTHALA", isServed: false });
    expect(p.localities).toEqual(["Bhagatpura, Phagwara B.O", "Phagwara H.O", "Phagwara Town S.O"]);
    expect(p.cityId).toEqual((await City.findOne({ code: "PB-KAPURTHALA" }).lean())._id);
    expect(await importPincodes({ input: csv(), format: "csv", apply: true })).toMatchObject({
      updated: 0,
      inserted: 0,
    });
  });

  it("refuses an unknown format and a CSV without the needed columns", async () => {
    await expect(importPincodes({ input: csv(), format: "xml" })).rejects.toThrow(/Unknown format/);
    const { Readable } = await import("node:stream");
    await expect(
      importPincodes({ input: Readable.from(["a,b\n1,2\n"]), format: "csv" }),
    ).rejects.toThrow(/missing/);
  });
});

describe("importBoundaries", () => {
  it("sets boundary, source and centroid; a rerun changes 0; reports gaps", async () => {
    await loadIndia();
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
      "110001",
      "144001",
      "144005",
      "144403",
      "144411",
      "190001",
      "744301",
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
    await loadIndia();
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

// Loads a pincode directory into `pincodes` and creates one City per (state, district) (decision O2).
// Called only by scripts/importPincodes.js. Writes only rows that differ, so a rerun changes nothing.
import mongoose from "mongoose";
import { City } from "../models/City.js";
import { Pincode } from "../models/Pincode.js";
import { circleFor } from "../utils/geo.js";
import { readDirectory } from "./pincodeDirectory.js";

const BATCH = 500;
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const batches = (list) =>
  Array.from({ length: Math.ceil(list.length / BATCH) }, (_, i) =>
    list.slice(i * BATCH, (i + 1) * BATCH),
  );

/** Upserts the district cities (new ones start `active`) and returns Map(code -> _id). */
async function upsertCities(cities, apply, report) {
  const ids = new Map();
  for (const batch of batches([...cities.values()])) {
    const codes = batch.map((c) => c.code);
    const stored = await City.find(
      { code: mongoose.trusted({ $in: codes }) },
      "code name stateCode",
    ).lean();
    const byCode = new Map(stored.map((c) => [c.code, c]));
    const ops = [];
    for (const city of batch) {
      const have = byCode.get(city.code);
      if (have) ids.set(city.code, have._id);
      if (have && have.name === city.name && have.stateCode === city.stateCode) continue;
      report[have ? "citiesUpdated" : "citiesCreated"] += 1;
      ops.push({
        updateOne: {
          filter: { code: city.code },
          update: {
            $set: { name: city.name, stateCode: city.stateCode },
            $setOnInsert: { status: "active" },
          },
          upsert: true,
        },
      });
    }
    if (apply && ops.length) {
      await City.bulkWrite(ops, { ordered: false });
      const fresh = await City.find({ code: mongoose.trusted({ $in: codes }) }, "code").lean();
      for (const c of fresh) ids.set(c.code, c._id);
    }
  }
  return ids;
}

/** The fields this source knows for one pincode. A CSV (no coordinates) never touches the shape. */
function wanted(entry, cityId, hasBoundary) {
  const want = {
    district: entry.district,
    state: entry.state,
    localities: entry.localities,
    cityId,
  };
  if (entry.positions.length) {
    const { centroid, radiusM } = circleFor(entry.positions);
    want.radiusM = radiusM;
    // A stored polygon owns the centroid (importBoundaries); the directory does not overwrite it.
    if (!hasBoundary) want.centroid = centroid;
    want.isServed = cityId != null; // false only in a dry run, before the city exists
  }
  return want;
}

/**
 * Dry run unless `apply`. `format`: geonames (default) or csv. `cityCode` (e.g. PB-KAPURTHALA) limits the run
 * to that district city's pincodes. Returns counts; a second --apply reports 0 inserted and 0 updated.
 */
export async function importPincodes({ input, format = "geonames", apply = false, cityCode } = {}) {
  const { pincodes, rows, badRows, unknownStates } = await readDirectory(input, format);
  const entries = [...pincodes].filter(([, e]) => !cityCode || e.cityCode === cityCode);
  if (cityCode && entries.length === 0) throw new Error(`No pincodes for city ${cityCode}`);

  const report = { applied: apply, format, rows, badRows, unknownStates, pincodes: entries.length };
  Object.assign(report, {
    citiesCreated: 0,
    citiesUpdated: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
  });

  const cities = new Map(
    entries.map(([, e]) => [
      e.cityCode,
      { code: e.cityCode, name: e.district, stateCode: e.stateCode },
    ]),
  );
  const cityIds = await upsertCities(cities, apply, report);

  for (const batch of batches(entries)) {
    const pins = batch.map(([pin]) => pin);
    const stored = await Pincode.find(
      { pin: mongoose.trusted({ $in: pins }) },
      "pin district state localities cityId centroid radiusM isServed boundarySource",
    ).lean();
    const byPin = new Map(stored.map((d) => [d.pin, d]));
    const ops = [];
    for (const [pin, entry] of batch) {
      const have = byPin.get(pin);
      const want = wanted(
        entry,
        cityIds.get(entry.cityCode) ?? null,
        have && have.boundarySource !== "none",
      );
      if (have && Object.keys(want).every((k) => same(have[k], want[k]))) {
        report.unchanged += 1;
        continue;
      }
      report[have ? "updated" : "inserted"] += 1;
      ops.push({ updateOne: { filter: { pin }, update: { $set: want }, upsert: true } });
    }
    // Unordered: one bad row does not stop the batch; the error still surfaces after it.
    if (apply && ops.length) await Pincode.bulkWrite(ops, { ordered: false });
  }
  return report;
}

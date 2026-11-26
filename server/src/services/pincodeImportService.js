// Loads the data.gov.in "All India Pincode Directory" CSV into `pincodes`. Called only by
// scripts/importPincodes.js. Streams the file; keeps one small aggregate per pincode (~19k).
import readline from "node:readline";
import mongoose from "mongoose";
import { City } from "../models/City.js";
import { Pincode } from "../models/Pincode.js";
import { PINCODE_RE } from "../utils/india.js";
import { parseCsvLine } from "../utils/csv.js";

const BATCH = 500;
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

// Decision O2. `--city PHG` creates or activates this city and marks its pincodes served.
export const PILOT_CITIES = Object.freeze({
  PHG: { name: "Phagwara", stateCode: "PB", pins: range(144401, 144411) },
});

/** Reads the CSV stream into Map(pin -> { district, state, localities: Set }). Bad rows are counted. */
async function readDirectory(input) {
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  const byPin = new Map();
  let col = null;
  let rows = 0;
  let badRows = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line).map((c) => c.trim());
    if (!col) {
      const header = cells.map((c) => c.replace(/^\uFEFF/, "").toLowerCase());
      col = Object.fromEntries(
        ["pincode", "officename", "district", "statename"].map((k) => [k, header.indexOf(k)]),
      );
      const missing = Object.keys(col).filter((k) => col[k] === -1);
      if (missing.length) throw new Error(`CSV header is missing: ${missing.join(", ")}`);
      continue;
    }
    rows += 1;
    const [pin, office, district, state] = [
      col.pincode,
      col.officename,
      col.district,
      col.statename,
    ].map((i) => cells[i] ?? "");
    if (!PINCODE_RE.test(pin) || !district || !state) {
      badRows += 1;
      continue;
    }
    const entry = byPin.get(pin) ?? { district, state, localities: new Set() };
    if (office) entry.localities.add(office.slice(0, 150));
    byPin.set(pin, entry);
  }
  if (!col) throw new Error("CSV is empty");
  return { byPin, rows, badRows };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Upserts every pincode in the CSV. Dry run unless `apply`. With `cityCode`, also upserts that pilot
 * city (status active) and sets `isServed` and `cityId` on its pincodes. Writes only rows that differ,
 * so a second run reports 0 inserted and 0 updated.
 */
export async function importPincodes({ input, apply = false, cityCode } = {}) {
  const pilot = cityCode ? PILOT_CITIES[cityCode] : null;
  if (cityCode && !pilot)
    throw new Error(`Unknown city ${cityCode}. Known: ${Object.keys(PILOT_CITIES)}`);

  const { byPin, rows, badRows } = await readDirectory(input);
  const report = {
    applied: apply,
    rows,
    badRows,
    pincodes: byPin.size,
    inserted: 0,
    updated: 0,
    unchanged: 0,
  };

  let cityId = null;
  if (pilot) {
    report.missingCityPins = pilot.pins.filter((p) => !byPin.has(p));
    const city = { name: pilot.name, stateCode: pilot.stateCode, status: "active" };
    const existing = await City.findOne({ code: cityCode });
    cityId = existing?._id ?? null;
    if (apply) {
      const saved = existing ?? new City({ code: cityCode });
      saved.set(city);
      await saved.save(); // no write when nothing changed
      cityId = saved._id;
    }
  }
  const served = new Set(pilot?.pins ?? []);

  const pins = [...byPin.keys()];
  for (let i = 0; i < pins.length; i += BATCH) {
    const batch = pins.slice(i, i + BATCH);
    const stored = new Map(
      (
        await Pincode.find(
          { pin: mongoose.trusted({ $in: batch }) },
          "pin district state localities isServed cityId",
        ).lean()
      ).map((d) => [d.pin, d]),
    );
    const ops = [];
    for (const pin of batch) {
      const { district, state, localities } = byPin.get(pin);
      const want = { district, state, localities: [...localities].sort() };
      if (served.has(pin)) Object.assign(want, { isServed: true, cityId });
      const have = stored.get(pin);
      const changed = !have || Object.keys(want).some((k) => !same(have[k] ?? null, want[k]));
      if (!changed) {
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

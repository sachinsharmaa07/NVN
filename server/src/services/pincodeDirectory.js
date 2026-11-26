// Reads a pincode directory file into one aggregate per pincode. Two formats:
//   geonames: GeoNames IN.txt (tab-separated, no header): country, postal_code, place_name, admin_name1,
//             admin_code1, admin_name2, admin_code2, admin_name3, admin_code3, latitude, longitude, accuracy
//   csv:      data.gov.in All India Pincode Directory (header row; no usable coordinates)
// Streams line by line; memory holds one small aggregate per pincode (~19k), not the file.
import readline from "node:readline";
import { PINCODE_RE, districtCityCode, stateCodeFor } from "../utils/india.js";
import { parseCsvLine } from "../utils/csv.js";
import { isIndiaPoint } from "../utils/geo.js";

export const FORMATS = Object.freeze(["geonames", "csv"]);

const CSV_COLUMNS = ["pincode", "officename", "district", "statename"];

/** Returns a function line -> { pin, place, district, state, position? } | null (skip). */
function rowReader(format) {
  if (format === "geonames") {
    return (line) => {
      const c = line.split("\t");
      const position = [Number(c[10]), Number(c[9])];
      return {
        pin: c[1]?.trim(),
        place: c[2]?.trim(),
        state: c[3]?.trim(),
        district: c[5]?.trim(),
        position:
          c[9] && c[10] && isIndiaPoint({ type: "Point", coordinates: position }) ? position : null,
      };
    };
  }
  let col = null;
  return (line) => {
    const cells = parseCsvLine(line).map((c) => c.trim());
    if (!col) {
      const header = cells.map((c) => c.replace(/^\uFEFF/, "").toLowerCase());
      col = CSV_COLUMNS.map((k) => header.indexOf(k));
      const missing = CSV_COLUMNS.filter((_, i) => col[i] === -1);
      if (missing.length) throw new Error(`CSV header is missing: ${missing.join(", ")}`);
      return null;
    }
    const [pin, place, district, state] = col.map((i) => cells[i] ?? "");
    return { pin, place, district, state, position: null };
  };
}

// The most common value; ties go to the alphabetically first, so reruns pick the same one.
const mode = (counts) => [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];

/**
 * @returns {{ pincodes: Map<pin, { cityCode, stateCode, district, state, localities: string[],
 *   positions: number[][] }>, rows, badRows, unknownStates: string[] }}
 */
export async function readDirectory(input, format = "geonames") {
  if (!FORMATS.includes(format))
    throw new Error(`Unknown format ${format}. Use ${FORMATS.join(" or ")}`);
  const read = rowReader(format);
  const byPin = new Map();
  const unknownStates = new Set();
  let rows = 0;
  let badRows = 0;
  for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const row = read(line);
    if (!row) continue;
    rows += 1;
    const stateCode = row.state ? stateCodeFor(row.state) : null;
    if (row.state && !stateCode) unknownStates.add(row.state);
    if (!PINCODE_RE.test(row.pin ?? "") || !row.district || !stateCode) {
      badRows += 1;
      continue;
    }
    const agg = byPin.get(row.pin) ?? { places: new Set(), areas: new Map(), positions: [] };
    if (row.place) agg.places.add(row.place.slice(0, 150));
    // One pincode can straddle districts: count them and keep the most common (state, district).
    const area = `${stateCode}\t${row.district}\t${row.state}`;
    agg.areas.set(area, (agg.areas.get(area) ?? 0) + 1);
    if (row.position) agg.positions.push(row.position);
    byPin.set(row.pin, agg);
  }
  if (rows === 0) throw new Error("The directory file has no rows");

  const pincodes = new Map();
  for (const [pin, agg] of byPin) {
    const [stateCode, district, state] = mode(agg.areas).split("\t");
    pincodes.set(pin, {
      cityCode: districtCityCode(stateCode, district),
      stateCode,
      district,
      state,
      localities: [...agg.places].sort(),
      positions: agg.positions,
    });
  }
  return { pincodes, rows, badRows, unknownStates: [...unknownStates].sort() };
}

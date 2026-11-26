// Puts pilot pincode boundaries (GeoJSON FeatureCollection) on existing `pincodes` rows. Called only by
// scripts/importBoundaries.js. Each feature needs a pincode in properties.pincode (or pin / Pincode).
import mongoose from "mongoose";
import { BOUNDARY_SOURCES, Pincode } from "../models/Pincode.js";
import { PINCODE_RE } from "../utils/india.js";
import { centroidOf, geometryProblems } from "../utils/geo.js";

const pinOf = (props = {}) => String(props.pincode ?? props.pin ?? props.Pincode ?? "").trim();
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Validates every feature and sets `boundary`, `boundarySource` and `centroid`. Dry run unless `apply`.
 * Writes only rows that differ (a rerun updates 0). Never throws for one bad feature: it is reported.
 */
export async function importBoundaries({ geojson, apply = false, source = "manual" } = {}) {
  if (!BOUNDARY_SOURCES.includes(source) || source === "none")
    throw new Error(`Bad source ${source}`);
  if (geojson?.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    throw new Error("Expected a GeoJSON FeatureCollection");
  }
  const report = { applied: apply, features: geojson.features.length, updated: 0, unchanged: 0 };
  report.invalid = []; // { pin, problems }
  report.unmatched = []; // pins with a polygon but no pincode row (run importPincodes first)

  for (const feature of geojson.features) {
    const pin = pinOf(feature.properties);
    const problems = PINCODE_RE.test(pin)
      ? geometryProblems(feature.geometry)
      : ["no valid pincode"];
    if (problems.length) {
      report.invalid.push({ pin, problems });
      continue;
    }
    const row = await Pincode.findOne({ pin });
    if (!row) {
      report.unmatched.push(pin);
      continue;
    }
    const boundary = { type: feature.geometry.type, coordinates: feature.geometry.coordinates };
    const want = { boundary, boundarySource: source, centroid: centroidOf(boundary) };
    const have = row.toObject();
    if (Object.keys(want).every((k) => same(have[k], want[k]))) {
      report.unchanged += 1;
      continue;
    }
    report.updated += 1;
    if (!apply) continue;
    row.set(want);
    try {
      await row.save(); // runs the model validators; MongoDB's 2dsphere check can still refuse it
    } catch (err) {
      report.updated -= 1;
      report.invalid.push({ pin, problems: [err.message] });
    }
  }

  // Served pincodes still without a polygon: the map cannot check a pin for these.
  report.servedWithoutBoundary = await Pincode.find(
    { isServed: true, boundary: mongoose.trusted({ $exists: false }) },
    "pin",
  )
    .sort({ pin: 1 })
    .lean()
    .then((rows) => rows.map((r) => r.pin));
  return report;
}

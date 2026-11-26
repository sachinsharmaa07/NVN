// Pincode reads for the report flow. checkPoint is the one place that decides "is this pin inside the
// pincode", so POST /api/issues (M1 step 8) must call locatePoint too, never its own copy.
import mongoose from "mongoose";
import { Pincode } from "../models/Pincode.js";
import { AppError } from "../utils/AppError.js";
import { distanceM } from "../utils/geo.js";
import { PINCODE_RE } from "../utils/india.js";

/**
 * Decision M1-7. `pincode`: a row with _id, boundary, centroid, radiusM. `point`: { lat, lng }.
 * Polygon when one exists (MongoDB $geoIntersects, "exact"), else the radius circle ("approx").
 */
export async function locatePoint(pincode, { lat, lng }) {
  if (pincode.boundary) {
    const geometry = { type: "Point", coordinates: [lng, lat] };
    const hit = await Pincode.exists({
      _id: pincode._id,
      // trusted: the global sanitizeFilter would otherwise turn the operator into a literal match.
      boundary: mongoose.trusted({ $geoIntersects: { $geometry: geometry } }),
    });
    return { inside: Boolean(hit), precision: "exact" };
  }
  const inside = distanceM(pincode.centroid.coordinates, [lng, lat]) <= pincode.radiusM;
  return { inside, precision: "approx" };
}

/** A served pincode row with what locatePoint and routing need. 404 unknown, 422 not served yet. */
export async function servedPincode(pin) {
  const row = await Pincode.findOne({ pin }, "isServed boundary centroid radiusM cityId").lean();
  if (!row) throw new AppError("PINCODE_NOT_FOUND", 404, "We don't know this pincode.");
  // A served pincode always has a city (decision O2); without one nothing could route the issue.
  if (!row.isServed || !row.cityId) {
    throw new AppError("PINCODE_NOT_SERVED", 422, "Nivaran doesn't cover this pincode yet.");
  }
  return row;
}

/** POST /api/pincodes/:pin/check-point. */
export async function checkPoint(pin, point) {
  return locatePoint(await servedPincode(pin), point);
}

/**
 * GET /api/pincodes/:pin. Every field the report wizard needs for step 1 and the map in step 2.
 * A known but unserved pincode is a 200 with served: false, so the wizard can offer the waitlist.
 */
export async function lookupPincode(pin) {
  if (!PINCODE_RE.test(pin)) {
    throw new AppError("INVALID_PINCODE", 400, "A pincode is 6 digits and does not start with 0.");
  }
  const row = await Pincode.findOne({ pin })
    .select("pin district state cityId localities centroid radiusM boundary isServed")
    .populate("cityId", "name")
    .lean();
  if (!row) throw new AppError("PINCODE_NOT_FOUND", 404, "We don't know this pincode.");
  return {
    pin: row.pin,
    district: row.district,
    state: row.state,
    cityName: row.cityId?.name ?? null,
    localities: row.localities,
    centroid: row.centroid ?? null,
    radiusM: row.radiusM ?? null,
    boundary: row.boundary ?? null,
    precision: row.boundary ? "exact" : "approx",
    served: row.isServed,
  };
}

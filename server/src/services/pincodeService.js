// Pincode reads for the report flow. checkPoint is the one place that decides "is this pin inside the
// pincode", so POST /api/issues (M1 step 8) must call locatePoint too, never its own copy.
import mongoose from "mongoose";
import { Pincode } from "../models/Pincode.js";
import { AppError } from "../utils/AppError.js";
import { distanceM } from "../utils/geo.js";

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

/** POST /api/pincodes/:pin/check-point. 404 for an unknown pin, 422 for one we do not serve yet. */
export async function checkPoint(pin, point) {
  const row = await Pincode.findOne({ pin }, "isServed boundary centroid radiusM").lean();
  if (!row) throw new AppError("PINCODE_NOT_FOUND", 404, "We don't know this pincode.");
  if (!row.isServed) {
    throw new AppError("PINCODE_NOT_SERVED", 422, "Nivaran doesn't cover this pincode yet.");
  }
  return locatePoint(row, point);
}

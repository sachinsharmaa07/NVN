// One row per Indian pincode, loaded by scripts/importPincodes.js and scripts/importBoundaries.js.
import mongoose from "mongoose";
import { PINCODE_RE } from "../utils/india.js";
import { RADIUS_MAX_M, RADIUS_MIN_M, geometryProblems, isIndiaPoint } from "../utils/geo.js";

export const BOUNDARY_SOURCES = Object.freeze(["aikosh", "manual", "none"]);

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const areaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Polygon", "MultiPolygon"], required: true },
    // Polygon: rings of [lon, lat]; MultiPolygon: one level deeper. Shape checked by geometryProblems.
    coordinates: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const pincodeSchema = new mongoose.Schema(
  {
    pin: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => PINCODE_RE.test(v),
        message: "pin must be 6 digits, not 0xxxxx",
      },
    },
    district: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City", default: null },
    localities: { type: [{ type: String, trim: true, maxlength: 150 }], default: [] },
    centroid: {
      type: pointSchema,
      validate: {
        validator: (v) => v == null || isIndiaPoint(v),
        message: "centroid must be [lon, lat]",
      },
    },
    boundary: {
      type: areaSchema,
      validate: {
        validator: (v) => v == null || geometryProblems(v).length === 0,
        message: (props) => geometryProblems(props.value).join("; "),
      },
    },
    // Decision M1-7: circle around the centroid used when there is no boundary.
    radiusM: { type: Number, min: RADIUS_MIN_M, max: RADIUS_MAX_M },
    boundarySource: { type: String, enum: BOUNDARY_SOURCES, default: "none" },
    isServed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Rules across fields: a source only with a boundary; a served pincode has its city and a shape.
pincodeSchema.pre("validate", function () {
  if ((this.boundarySource === "none") !== (this.boundary == null)) {
    this.invalidate("boundarySource", 'boundarySource is "none" exactly when there is no boundary');
  }
  if (this.isServed && !this.cityId) this.invalidate("cityId", "a served pincode needs a cityId");
  // A served pincode must be checkable: a polygon, or a centre and radius.
  if (this.isServed && !this.boundary && !(this.centroid && this.radiusM)) {
    this.invalidate("radiusM", "a served pincode needs a boundary or a centroid and radiusM");
  }
});

// `pin` is unique by its option. 2dsphere v2+ skips rows without a boundary, so it is sparse-safe.
pincodeSchema.index({ boundary: "2dsphere" });
pincodeSchema.index({ cityId: 1, isServed: 1 });

export const Pincode = mongoose.model("Pincode", pincodeSchema);

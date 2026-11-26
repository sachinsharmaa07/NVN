// How long a category may take (decision 3). cityId null = the national default; a city row overrides it.
import mongoose from "mongoose";
import { CATEGORIES } from "../utils/categories.js";

const MAX_HOURS = 24 * 90;

const slaPolicySchema = new mongoose.Schema(
  {
    category: { type: String, required: true, enum: CATEGORIES },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City", default: null },
    respondHours: { type: Number, required: true, min: 1, max: MAX_HOURS },
    resolveHours: { type: Number, required: true, min: 1, max: MAX_HOURS },
  },
  { timestamps: true },
);

slaPolicySchema.pre("validate", function () {
  if (this.resolveHours < this.respondHours) {
    this.invalidate("resolveHours", "resolveHours must be at least respondHours");
  }
});

// One policy per (category, city); null cityId is a value too, so there is exactly one national default.
slaPolicySchema.index({ category: 1, cityId: 1 }, { unique: true });

export const SlaPolicy = mongoose.model("SlaPolicy", slaPolicySchema);

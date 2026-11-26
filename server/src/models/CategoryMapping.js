// Which department of a city handles a category (decision 2). `queue: "triage"` means no department:
// a city admin sorts it by hand. "other" always goes to triage (decision M1-6).
import mongoose from "mongoose";
import { CATEGORIES } from "../utils/categories.js";

export const QUEUES = Object.freeze(["department", "triage"]);

const categoryMappingSchema = new mongoose.Schema(
  {
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true },
    category: { type: String, required: true, enum: CATEGORIES },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    queue: { type: String, required: true, enum: QUEUES },
  },
  { timestamps: true },
);

categoryMappingSchema.pre("validate", function () {
  if ((this.queue === "triage") !== (this.departmentId == null)) {
    this.invalidate("queue", 'queue is "triage" exactly when there is no departmentId');
  }
  if (this.category === "other" && this.queue !== "triage") {
    this.invalidate("queue", '"other" always goes to triage');
  }
});

// One answer per city and category; also the lookup index for routing an issue.
categoryMappingSchema.index({ cityId: 1, category: 1 }, { unique: true });

export const CategoryMapping = mongoose.model("CategoryMapping", categoryMappingSchema);

// Placeholder: Phase 2 owns the full City model. Phase 1 needs it for scope checks and the geo pickers.
import mongoose from "mongoose";
import { INDIA_STATE_CODES } from "../utils/india.js";
import { Department } from "./Department.js";
import { User } from "./User.js";

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, unique: true, match: /^[A-Z0-9]{2,10}$/ },
    stateCode: { type: String, required: true, enum: INDIA_STATE_CODES },
  },
  { timestamps: true },
);

// State officers list their state's cities, name-sorted. `code` is unique-indexed by its option.
citySchema.index({ stateCode: 1, name: 1 });

// MongoDB has no foreign keys, so deletion is blocked here while anything still points at the city.
const refuseIfReferenced = async (ids) => {
  const where = { $in: ids };
  const used =
    (await User.exists({ cityId: mongoose.trusted(where) })) ||
    (await Department.exists({ cityId: mongoose.trusted(where) }));
  if (used) throw new Error("City is still referenced by users or departments");
};
citySchema.pre(
  ["deleteOne", "deleteMany", "findOneAndDelete"],
  { query: true, document: false },
  async function () {
    await refuseIfReferenced(await this.model.find(this.getFilter()).distinct("_id"));
  },
);
citySchema.pre("deleteOne", { query: false, document: true }, async function () {
  await refuseIfReferenced([this._id]);
});

export const City = mongoose.model("City", citySchema);

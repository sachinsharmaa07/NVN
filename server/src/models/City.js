// A city Nivaran serves or is onboarding. Scope checks, admin pickers and pincodes point at it.
import mongoose from "mongoose";
import { INDIA_STATE_CODES } from "../utils/india.js";
import { Department } from "./Department.js";
import { Pincode } from "./Pincode.js";
import { User } from "./User.js";

export const CITY_STATUSES = Object.freeze(["active", "onboarding"]);

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Hand-made (LDH) or a district city from the import (PB-KAPURTHALA, decision O2).
    code: { type: String, required: true, unique: true, match: /^[A-Z0-9][A-Z0-9-]{1,39}$/ },
    stateCode: { type: String, required: true, enum: INDIA_STATE_CODES },
    // onboarding: set up by admins, not yet taking reports; active: live for residents.
    status: { type: String, enum: CITY_STATUSES, default: "onboarding" },
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
    (await Department.exists({ cityId: mongoose.trusted(where) })) ||
    (await Pincode.exists({ cityId: mongoose.trusted(where) }));
  if (used) throw new Error("City is still referenced by users, departments or pincodes");
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

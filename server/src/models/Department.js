// A city's department. No stateCode (it would drift from City) and no categories: the category to
// department map is its own collection (M1 step 6).
import mongoose from "mongoose";
import { User } from "./User.js";

const departmentSchema = new mongoose.Schema(
  {
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, match: /^[A-Z0-9_]{2,20}$/ },
  },
  { timestamps: true },
);

departmentSchema.index({ cityId: 1, code: 1 }, { unique: true });

// MongoDB has no foreign keys, so deletion is blocked here while users still point at the department.
const refuseIfReferenced = async (ids) => {
  if (await User.exists({ departmentId: mongoose.trusted({ $in: ids }) })) {
    throw new Error("Department is still referenced by users");
  }
};
departmentSchema.pre(
  ["deleteOne", "deleteMany", "findOneAndDelete"],
  { query: true, document: false },
  async function () {
    await refuseIfReferenced(await this.model.find(this.getFilter()).distinct("_id"));
  },
);
departmentSchema.pre("deleteOne", { query: false, document: true }, async function () {
  await refuseIfReferenced([this._id]);
});

export const Department = mongoose.model("Department", departmentSchema);

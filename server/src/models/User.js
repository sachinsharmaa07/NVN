import mongoose from "mongoose";
import { ROLES } from "../utils/access.js";

const userSchema = new mongoose.Schema(
  {
    // The token's `sub` (e.g. "google-oauth2|1234"). Our link to the Auth0 account.
    auth0Id: { type: String, required: true, unique: true, immutable: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, trim: true, maxlength: 100, default: "" },
    // Roles live here, not in Auth0, so changing one never needs a tenant edit or a new token.
    role: { type: String, enum: ROLES, default: "citizen", required: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // A copy of the token's email_verified, refreshed on every GET /api/me. The token wins on requests.
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "suspended"], default: "active", required: true },
  },
  { timestamps: true },
);

// Staff lists by city and role (DESIGN.md section 3). auth0Id is already unique-indexed above.
userSchema.index({ cityId: 1, role: 1 });

export const User = mongoose.model("User", userSchema);

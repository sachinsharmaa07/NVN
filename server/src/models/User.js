import mongoose from "mongoose";
import { INDIA_STATE_CODES, PINCODE_RE } from "../utils/india.js";
import { ROLES, SCOPE_RULES } from "../utils/permissions.js";

const { ObjectId } = mongoose.Schema.Types;

// Explicit validate functions, not `match`: Mongoose's `match` silently accepts "" (empty-string drift).
const avatarOk = {
  validator: (v) => v == null || v === "" || /^https:\/\/\S+$/.test(v),
  message: "avatarUrl must be empty or an https URL",
};
const pincodeOk = {
  validator: (v) => v == null || PINCODE_RE.test(v),
  message: "defaultPincode must be 6 digits, first digit 1 to 9",
};

const userSchema = new mongoose.Schema(
  {
    // The token's `sub` (e.g. "google-oauth2|1234"). Our identity link to Auth0; never changes.
    auth0Id: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      maxlength: 128,
    },
    // Contact only, never an identity: NOT unique (a Google and a password login can share one address).
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    // Mirror of the token claim, refreshed by the login throttle. The token decides on each request.
    emailVerified: { type: Boolean, required: true, default: false },
    name: { type: String, trim: true, maxlength: 100, default: "" },
    // Only https URLs (or empty), so a `javascript:` or `data:` avatar can never reach the client.
    avatarUrl: { type: String, maxlength: 2048, default: "", validate: avatarOk },
    // Roles live here, not in Auth0, so changing one needs no tenant edit or new token.
    role: { type: String, enum: ROLES, default: "citizen", required: true },
    // Scope fields are absent (not null) unless the role needs them; SCOPE_RULES decides, see the hook below.
    cityId: { type: ObjectId, ref: "City" },
    departmentId: { type: ObjectId, ref: "Department" },
    stateCode: { type: String, enum: INDIA_STATE_CODES },
    status: { type: String, enum: ["active", "suspended"], default: "active", required: true },
    // Shown to the suspended user, so it must be written user-safe. Present only while suspended.
    suspendedReason: { type: String, trim: true, minlength: 3, maxlength: 500 },
    suspendedAt: { type: Date },
    suspendedBy: { type: ObjectId, ref: "User" },
    preferredLanguage: { type: String, enum: ["en", "hi"], default: "en" },
    defaultPincode: { type: String, validate: pincodeOk }, // absent or 6 digits; "" is invalid
    lastLoginAt: { type: Date }, // accurate to about 15 minutes (login throttle)
  },
  // Two admins changing one user: the loser's save() throws VersionError, which becomes 409.
  { timestamps: true, optimisticConcurrency: true },
);

const SCOPE_FIELDS = ["cityId", "departmentId", "stateCode"];
const SUSPENSION_FIELDS = ["suspendedReason", "suspendedAt", "suspendedBy"];

// The whole-document invariants no single field can express. Runs on save() and validate().
userSchema.pre("validate", function () {
  const rule = SCOPE_RULES[this.role];
  for (const f of SCOPE_FIELDS) {
    const isSet = this[f] != null;
    if (rule?.[f] === "R" && !isSet) this.invalidate(f, `required for ${this.role}`);
    if (rule?.[f] === "F" && isSet) this.invalidate(f, `forbidden for ${this.role}`);
  }
  const suspended = this.status === "suspended";
  for (const f of SUSPENSION_FIELDS) {
    if (suspended !== (this[f] != null)) {
      this.invalidate(f, suspended ? "required when suspended" : "must be empty when active");
    }
  }
});

// Update operators, replacements and bulk writes run no whole-document validation, so a stray call
// could change a role, scope or status unchecked. Block every such form unless the caller opts in
// with { scopeWrite: true }; role, scope and status changes go through load -> mutate -> save().
const GUARDED = ["role", "status", ...SCOPE_FIELDS, ...SUSPENSION_FIELDS];
const isGuarded = (path) => GUARDED.includes(String(path).split(".")[0]);

// What a brand-new citizen may be created with by $setOnInsert (the first-login upsert).
const INSERT_ALLOWED = new Set([
  "email",
  "emailVerified",
  "name",
  "avatarUrl",
  "role",
  "status",
  "preferredLanguage",
  "lastLoginAt",
  "createdAt",
  "updatedAt", // the last two are added by `timestamps`
]);
const INSERT_FIXED = { role: "citizen", status: "active" };
const refuse = (why) => {
  throw new Error(
    `User write refused: ${why}. Use save(), or pass { scopeWrite: true } on purpose.`,
  );
};

/** Returns a reason string when this update document touches guarded fields, else null. */
export function guardedUpdateProblem(update) {
  if (Array.isArray(update)) return "pipeline updates cannot be checked";
  const doc = update ?? {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "$setOnInsert") {
      for (const [path, v] of Object.entries(value ?? {})) {
        if (!INSERT_ALLOWED.has(path)) return `$setOnInsert of ${path}`;
        if (path in INSERT_FIXED && v !== INSERT_FIXED[path])
          return `$setOnInsert ${path} must be ${INSERT_FIXED[path]}`;
      }
    } else if (key === "$rename") {
      // Both sides count: renaming something INTO role is as bad as renaming role away.
      for (const [from, to] of Object.entries(value ?? {}))
        if (isGuarded(from) || isGuarded(to)) return `$rename ${from} -> ${to}`;
    } else if (key.startsWith("$")) {
      for (const path of Object.keys(value ?? {})) if (isGuarded(path)) return `${key} ${path}`;
    } else if (isGuarded(key)) {
      return `replacement sets ${key}`; // a plain document (replaceOne): no operators at all
    }
  }
  return null;
}

userSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"],
  { query: true, document: false },
  function () {
    if (this.getOptions().scopeWrite === true) return;
    const op = this.op;
    const update = this.getUpdate();
    // A replacement document would overwrite the whole row, role and scope included.
    if (op === "replaceOne" || op === "findOneAndReplace") refuse("replacement writes");
    const problem = guardedUpdateProblem(update);
    if (problem) refuse(problem);
  },
);

// Documents for insertMany/bulkWrite skip the save() path, so check what they would insert.
function insertProblem(doc) {
  const d = doc ?? {};
  if (d.role != null && d.role !== "citizen") return "role other than citizen";
  if (d.status != null && d.status !== "active") return "status other than active";
  const bad = [...SCOPE_FIELDS, ...SUSPENSION_FIELDS].find((f) => d[f] != null);
  return bad ? `${bad} on insert` : null;
}
userSchema.pre("insertMany", function (docs) {
  // Mongoose passes no options to this hook, so there is no scopeWrite escape: seed with create().
  const problem = [].concat(docs).map(insertProblem).find(Boolean);
  if (problem) refuse(`insertMany ${problem}`);
});
userSchema.pre("bulkWrite", function (ops, options) {
  if (options?.scopeWrite === true) return;
  for (const op of ops ?? []) {
    if (!op.insertOne) refuse("bulkWrite of anything but insertOne");
    const problem = insertProblem(op.insertOne.document);
    if (problem) refuse(`bulkWrite ${problem}`);
  }
});

// Indexes (docs/phase-1-auth.md 6.2). auth0Id is unique-indexed by its field option above.
userSchema.index({ email: 1 }); // exact lookup and anchored email-prefix search
userSchema.index({ cityId: 1, createdAt: -1, _id: -1 }); // city list without a role filter
userSchema.index({ cityId: 1, role: 1, createdAt: -1, _id: -1 }); // city list with a role filter
// State officers' direct stateCode rows (partial: most users have none). No department list in Phase 1.
userSchema.index(
  { stateCode: 1, createdAt: -1, _id: -1 },
  { partialFilterExpression: { stateCode: { $exists: true } } },
);
userSchema.index({ role: 1, createdAt: -1, _id: -1 }); // super_admin role filter
userSchema.index({ createdAt: -1, _id: -1 }); // super_admin unfiltered list

export const User = mongoose.model("User", userSchema);

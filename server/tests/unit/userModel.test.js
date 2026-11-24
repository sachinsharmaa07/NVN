// Schema rules for User, checked with validate() (no database connection needed).
import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { User, guardedUpdateProblem } from "../../src/models/User.js";
import { expectStoppedByHook } from "../helpers/hooks.js";

const oid = () => new mongoose.Types.ObjectId();
const base = { auth0Id: "auth0|u1", email: "a@example.com", emailVerified: true };

/** Returns the set of invalid paths, or [] when valid. */
async function invalidPaths(fields) {
  try {
    await new User({ ...base, ...fields }).validate();
    return [];
  } catch (err) {
    return Object.keys(err.errors ?? {}).sort();
  }
}

// R = required, F = forbidden, as in docs/phase-1-auth.md section 6.1 (a literal copy on purpose).
const RULES = {
  citizen: { cityId: "F", departmentId: "F", stateCode: "F" },
  moderator: { cityId: "R", departmentId: "F", stateCode: "F" },
  staff: { cityId: "R", departmentId: "R", stateCode: "F" },
  dept_head: { cityId: "R", departmentId: "R", stateCode: "F" },
  city_admin: { cityId: "R", departmentId: "F", stateCode: "F" },
  state_officer: { cityId: "F", departmentId: "F", stateCode: "R" },
  super_admin: { cityId: "F", departmentId: "F", stateCode: "F" },
};
const VALUE = { cityId: oid(), departmentId: oid(), stateCode: "PB" };

describe("User scope rules per role", () => {
  for (const [role, rule] of Object.entries(RULES)) {
    const required = Object.keys(rule).filter((f) => rule[f] === "R");
    const forbidden = Object.keys(rule).filter((f) => rule[f] === "F");
    const valid = Object.fromEntries(required.map((f) => [f, VALUE[f]]));

    it(`${role}: exactly the required fields is valid`, async () => {
      expect(await invalidPaths({ role, ...valid })).toEqual([]);
    });
    for (const f of required) {
      it(`${role}: missing ${f} is invalid`, async () => {
        const { [f]: _omit, ...without } = valid;
        expect(await invalidPaths({ role, ...without })).toContain(f);
      });
    }
    for (const f of forbidden) {
      it(`${role}: ${f} set is invalid`, async () => {
        expect(await invalidPaths({ role, ...valid, [f]: VALUE[f] })).toContain(f);
      });
    }
  }

  it("an unknown role is invalid", async () => {
    expect(await invalidPaths({ role: "emperor" })).toContain("role");
  });
});

describe("User field rules", () => {
  it("lowercases and trims the email", async () => {
    const u = new User({ ...base, email: "  Asha@Example.COM " });
    await u.validate();
    expect(u.email).toBe("asha@example.com");
  });
  it("defaults: citizen, active, language en, not verified, empty name", () => {
    const u = new User({ auth0Id: "auth0|x", email: "x@example.com" });
    expect([u.role, u.status, u.preferredLanguage, u.emailVerified, u.name]).toEqual([
      "citizen",
      "active",
      "en",
      false,
      "",
    ]);
  });
  it.each([
    ["stateCode not an ISO code", { role: "state_officer", stateCode: "ZZ" }, "stateCode"],
    ["pincode starting with 0", { defaultPincode: "012345" }, "defaultPincode"],
    ["pincode with 5 digits", { defaultPincode: "14440" }, "defaultPincode"],
    ["language not en or hi", { preferredLanguage: "fr" }, "preferredLanguage"],
    ["avatar javascript: URL", { avatarUrl: "javascript:alert(1)" }, "avatarUrl"],
    ["avatar data: URL", { avatarUrl: "data:text/html,x" }, "avatarUrl"],
    ["avatar http (not https)", { avatarUrl: "http://x.example/a.png" }, "avatarUrl"],
    ["name over 100 characters", { name: "x".repeat(101) }, "name"],
    ["email over 254 characters", { email: `${"x".repeat(250)}@e.co` }, "email"],
    ["auth0Id over 128 characters", { auth0Id: "x".repeat(129) }, "auth0Id"],
    ["status not active or suspended", { status: "banned" }, "status"],
  ])("%s is invalid", async (_n, fields, path) => {
    expect(await invalidPaths(fields)).toContain(path);
  });
  it.each([
    [{ defaultPincode: "144401" }],
    [{ preferredLanguage: "hi" }],
    [{ avatarUrl: "https://lh3.example/a.png" }],
    [{ avatarUrl: "" }],
  ])("accepts %j", async (fields) => {
    expect(await invalidPaths(fields)).toEqual([]);
  });
  it("email is not unique: two users may share an address (no merging by email)", () => {
    const emailIndex = User.schema.indexes().find(([spec]) => spec.email === 1 && !spec.cityId);
    expect(emailIndex?.[1]?.unique).toBeFalsy();
  });
  it("auth0Id is unique and immutable", () => {
    expect(User.schema.path("auth0Id").options.unique).toBe(true);
    expect(User.schema.path("auth0Id").options.immutable).toBe(true);
  });
});

describe("User suspension fields move together", () => {
  const susp = {
    status: "suspended",
    suspendedReason: "spam posts",
    suspendedAt: new Date(),
    suspendedBy: oid(),
  };
  it("suspended with reason, at and by is valid", async () => {
    expect(await invalidPaths(susp)).toEqual([]);
  });
  it.each(["suspendedReason", "suspendedAt", "suspendedBy"])(
    "suspended without %s is invalid",
    async (f) => {
      const { [f]: _omit, ...rest } = susp;
      expect(await invalidPaths(rest)).toContain(f);
    },
  );
  it("active with a suspension reason is invalid", async () => {
    expect(await invalidPaths({ status: "active", suspendedReason: "x y z" })).toContain(
      "suspendedReason",
    );
  });
  it("a reason shorter than 3 characters is invalid", async () => {
    expect(await invalidPaths({ ...susp, suspendedReason: "ab" })).toContain("suspendedReason");
  });
});

describe("User write guard: role, scope and status change only on purpose", () => {
  it.each([
    ["role", { $set: { role: "super_admin" } }],
    ["cityId", { $set: { cityId: oid() } }],
    ["stateCode", { $set: { stateCode: "PB" } }],
    ["status", { $set: { status: "suspended" } }],
    ["suspendedReason", { $set: { suspendedReason: "xyz" } }],
  ])("updateOne touching %s without { scopeWrite: true } is rejected", async (_n, update) => {
    await expectStoppedByHook(() => User.updateOne({ auth0Id: "auth0|x" }, update).exec());
    await expectStoppedByHook(() => User.findOneAndUpdate({ auth0Id: "auth0|x" }, update).exec());
  });
});

describe("User write guard: every form of write", () => {
  const stopped = (run) => expectStoppedByHook(run);
  it.each([
    ["updateMany", () => User.updateMany({}, { $set: { role: "super_admin" } }).exec()],
    [
      "replaceOne",
      () => User.replaceOne({ auth0Id: "a" }, { auth0Id: "a", email: "a@b.in" }).exec(),
    ],
    [
      "findOneAndReplace",
      () => User.findOneAndReplace({ auth0Id: "a" }, { email: "a@b.in" }).exec(),
    ],
    [
      "bulkWrite updateOne",
      () =>
        User.bulkWrite([{ updateOne: { filter: {}, update: { $set: { role: "super_admin" } } } }]),
    ],
    [
      "bulkWrite insertOne with a role",
      () =>
        User.bulkWrite([
          { insertOne: { document: { auth0Id: "x", email: "a@b.in", role: "super_admin" } } },
        ]),
    ],
    [
      "insertMany with a role",
      () => User.insertMany([{ auth0Id: "x", email: "a@b.in", role: "city_admin" }]),
    ],
    [
      "insertMany suspended",
      () => User.insertMany([{ auth0Id: "x", email: "a@b.in", status: "suspended" }]),
    ],
    [
      "$setOnInsert of a city",
      () =>
        User.updateOne(
          { auth0Id: "a" },
          { $setOnInsert: { cityId: oid() } },
          { upsert: true },
        ).exec(),
    ],
    [
      "$setOnInsert of role admin",
      () =>
        User.updateOne(
          { auth0Id: "a" },
          { $setOnInsert: { role: "city_admin" } },
          { upsert: true },
        ).exec(),
    ],
    [
      "$rename into role",
      () => User.updateOne({ auth0Id: "a" }, { $rename: { name: "role" } }).exec(),
    ],
    [
      "$rename away from status",
      () => User.updateOne({ auth0Id: "a" }, { $rename: { status: "x" } }).exec(),
    ],
    ["$unset of a city", () => User.updateOne({ auth0Id: "a" }, { $unset: { cityId: "" } }).exec()],
    ["dotted path", () => User.updateOne({ auth0Id: "a" }, { $set: { "role.x": 1 } }).exec()],
  ])("%s is rejected without scopeWrite", async (_n, run) => {
    await stopped(run);
  });
});

describe("guardedUpdateProblem (the rule itself)", () => {
  it.each([
    [
      "first-login upsert",
      {
        $setOnInsert: {
          email: "a@b.in",
          emailVerified: true,
          name: "",
          avatarUrl: "",
          role: "citizen",
          status: "active",
          preferredLanguage: "en",
          lastLoginAt: new Date(),
        },
      },
      false,
    ],
    [
      "throttle refresh",
      { $set: { email: "a@b.in", lastLoginAt: new Date(), emailVerified: true, avatarUrl: "" } },
      false,
    ],
    ["profile edit", { $set: { name: "x" }, $unset: { defaultPincode: "" } }, false],
    [
      "$setOnInsert role citizen with timestamps",
      { $setOnInsert: { role: "citizen", createdAt: new Date() }, $set: { updatedAt: new Date() } },
      false,
    ],
    ["pipeline update", [{ $set: { role: "super_admin" } }], true],
    ["$setOnInsert unknown key", { $setOnInsert: { suspendedAt: new Date() } }, true],
    ["$setOnInsert role admin", { $setOnInsert: { role: "super_admin" } }, true],
    ["$setOnInsert status suspended", { $setOnInsert: { status: "suspended" } }, true],
    ["$inc status", { $inc: { status: 1 } }, true],
    ["$rename value", { $rename: { name: "stateCode" } }, true],
    ["$rename key", { $rename: { departmentId: "x" } }, true],
    ["$set suspendedBy", { $set: { suspendedBy: "x" } }, true],
    ["plain replacement with role", { role: "super_admin" }, true],
  ])("%s", (_n, update, bad) => {
    expect(Boolean(guardedUpdateProblem(update))).toBe(bad);
  });
});

describe("User field validators reject empty-string drift", () => {
  it("defaultPincode of '' is invalid, absent is fine", async () => {
    expect(await invalidPaths({ defaultPincode: "" })).toContain("defaultPincode");
    expect(await invalidPaths({})).not.toContain("defaultPincode");
  });
  it.each([["javascript:alert(1)"], ["http://x.in/a.png"], ["https://"]])(
    "avatarUrl %s is invalid",
    async (url) => {
      expect(await invalidPaths({ avatarUrl: url })).toContain("avatarUrl");
    },
  );
  it("avatarUrl '' and an https URL are valid", async () => {
    expect(await invalidPaths({ avatarUrl: "" })).not.toContain("avatarUrl");
    expect(await invalidPaths({ avatarUrl: "https://x.in/a.png" })).not.toContain("avatarUrl");
  });
});

describe("User indexes", () => {
  const keys = User.schema.indexes().map(([k]) => Object.keys(k).join(","));
  it("has the city, state and role indexes and no department index", () => {
    expect(keys).toContain("cityId,createdAt,_id");
    expect(keys).toContain("cityId,role,createdAt,_id");
    expect(keys).toContain("stateCode,createdAt,_id");
    expect(keys.some((k) => k.startsWith("departmentId"))).toBe(false);
  });
});

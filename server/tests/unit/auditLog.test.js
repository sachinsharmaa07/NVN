// AuditLog: schema rules, and the hooks that make it append-only (no database connection needed).
import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { AuditLog } from "../../src/models/AuditLog.js";
import { expectStoppedByHook } from "../helpers/hooks.js";

const oid = () => new mongoose.Types.ObjectId();
const userRow = {
  actorType: "user",
  actorId: oid(),
  actorRole: "city_admin",
  action: "user.role_change",
  targetType: "user",
  targetId: oid(),
  reason: "promoted after interview",
  before: { role: "citizen" },
  after: { role: "moderator" },
};
const systemRow = {
  actorType: "system",
  actorLabel: "script:bootstrap-super-admin",
  action: "user.bootstrap_super_admin",
  targetType: "user",
  targetId: oid(),
};

async function invalidPaths(fields) {
  try {
    await new AuditLog(fields).validate();
    return [];
  } catch (err) {
    return Object.keys(err.errors ?? {}).sort();
  }
}

describe("AuditLog schema", () => {
  it("a user-actor row and a system-actor row are valid", async () => {
    expect(await invalidPaths(userRow)).toEqual([]);
    expect(await invalidPaths(systemRow)).toEqual([]);
  });
  it("has no createdAt/updatedAt/__v: one immutable `at`", () => {
    expect(AuditLog.schema.options.timestamps).toBeFalsy();
    expect(AuditLog.schema.options.versionKey).toBe(false);
    expect(AuditLog.schema.path("at").options.immutable).toBe(true);
    expect(AuditLog.schema.path("action").options.immutable).toBe(true);
  });
  it.each([
    ["user actor without actorId", { ...userRow, actorId: undefined }, "actorId"],
    ["user actor without actorRole", { ...userRow, actorRole: undefined }, "actorRole"],
    ["system actor without actorLabel", { ...systemRow, actorLabel: undefined }, "actorLabel"],
    ["unknown action", { ...userRow, action: "user.delete" }, "action"],
    ["unknown actorType", { ...userRow, actorType: "robot" }, "actorType"],
    ["role_change without reason", { ...userRow, reason: undefined }, "reason"],
    ["reason under 3 characters", { ...userRow, reason: "ab" }, "reason"],
    ["no targetId", { ...userRow, targetId: undefined }, "targetId"],
    ["ip over 45 characters", { ...userRow, ip: "1".repeat(46) }, "ip"],
    ["requestId over 64 characters", { ...userRow, requestId: "r".repeat(65) }, "requestId"],
  ])("%s is invalid", async (_n, fields, path) => {
    expect(await invalidPaths(fields)).toContain(path);
  });
  it.each(["user.role_change", "user.suspend", "user.reactivate"])(
    "%s needs a reason",
    async (action) => {
      expect(await invalidPaths({ ...userRow, action, reason: undefined })).toContain("reason");
    },
  );
  it("accepts every action in the approved list", async () => {
    for (const action of [
      "user.role_change",
      "user.suspend",
      "user.reactivate",
      "user.bootstrap_super_admin",
      "user.mfa_flag_sync_failed",
    ]) {
      const row =
        action === "user.bootstrap_super_admin" || action === "user.mfa_flag_sync_failed"
          ? systemRow
          : userRow;
      expect(await invalidPaths({ ...row, action })).toEqual([]);
    }
  });
  it("before/after over 4 KB is invalid", async () => {
    expect(await invalidPaths({ ...userRow, before: { role: "x".repeat(5000) } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/before|after/)]),
    );
  });
  it("has the three approved indexes", () => {
    const specs = AuditLog.schema.indexes().map(([spec]) => JSON.stringify(spec));
    expect(specs).toEqual(
      expect.arrayContaining([
        JSON.stringify({ targetType: 1, targetId: 1, at: -1 }),
        JSON.stringify({ at: -1, _id: -1 }),
        JSON.stringify({ actorId: 1, at: -1 }),
      ]),
    );
  });
});

describe("A23 AuditLog is append-only (hooks stop every change, no database needed)", () => {
  const existing = () => AuditLog.hydrate({ _id: oid(), ...userRow, at: new Date() });

  it.each([
    ["updateOne", () => AuditLog.updateOne({}, { $set: { reason: "edited" } }).exec()],
    ["updateMany", () => AuditLog.updateMany({}, { $set: { reason: "edited" } }).exec()],
    ["findOneAndUpdate", () => AuditLog.findOneAndUpdate({}, { $set: { reason: "x y z" } }).exec()],
    ["findOneAndReplace", () => AuditLog.findOneAndReplace({}, { ...userRow }).exec()],
    ["findOneAndDelete", () => AuditLog.findOneAndDelete({}).exec()],
    ["replaceOne", () => AuditLog.replaceOne({}, { ...userRow }).exec()],
    ["deleteOne", () => AuditLog.deleteOne({}).exec()],
    ["deleteMany", () => AuditLog.deleteMany({}).exec()],
    ["bulkWrite", () => AuditLog.bulkWrite([{ deleteOne: { filter: {} } }])],
    ["save() on an existing document", () => existing().save()],
    ["document.deleteOne()", () => existing().deleteOne()],
  ])("%s is rejected", async (_name, run) => {
    await expectStoppedByHook(run);
  });
});
it("at defaults through the clock", () => {
  expect(new AuditLog({}).at).toBeInstanceOf(Date);
});

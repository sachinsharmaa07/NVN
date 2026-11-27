// migrate:users-v3: removes the leftover auth0Id, only where auth0Ids already holds it.
import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/testDb.js";
import { User } from "../../src/models/User.js";
import { migrateUsersV3 } from "../../src/services/migrationService.js";

useTestDb();

const row = (n, extra) => ({
  _id: new mongoose.Types.ObjectId(),
  email: `u${n}@example.com`,
  emailVerified: true,
  role: "citizen",
  status: "active",
  ...extra,
});

describe("migrateUsersV3", () => {
  it("dry run counts, --apply removes only copied ids, a rerun changes nothing", async () => {
    const copied = row(1, { auth0Id: "google-oauth2|1", auth0Ids: ["google-oauth2|1"] });
    const notCopied = row(2, { auth0Id: "google-oauth2|2", auth0Ids: ["email|2"] });
    const clean = row(3, { auth0Ids: ["email|3"] });
    await User.collection.insertMany([copied, notCopied, clean]);

    expect(await migrateUsersV3()).toEqual({ applied: false, toRemove: 1, notCopied: 1 });
    expect((await User.collection.findOne({ _id: copied._id })).auth0Id).toBe("google-oauth2|1");

    expect(await migrateUsersV3({ apply: true })).toMatchObject({ applied: true, toRemove: 1 });
    expect(await User.collection.findOne({ _id: copied._id })).not.toHaveProperty("auth0Id");
    expect((await User.collection.findOne({ _id: notCopied._id })).auth0Id).toBe("google-oauth2|2");

    expect(await migrateUsersV3({ apply: true })).toMatchObject({ toRemove: 0, notCopied: 1 });
  });
});

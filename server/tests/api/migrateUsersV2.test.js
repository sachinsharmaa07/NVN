// migrate:users-v2 on a real database: dry run writes nothing, --apply copies auth0Id into auth0Ids
// and builds the new indexes, and duplicate verified emails stop it before any write.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/testDb.js";
import { User } from "../../src/models/User.js";
import { migrateUsersV2 } from "../../src/services/migrationService.js";

useTestDb();

const oldRow = (n, extra = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  auth0Id: `google-oauth2|${n}`,
  email: `u${n}@example.com`,
  emailVerified: true,
  role: "citizen",
  status: "active",
  ...extra,
});
const indexNames = async () => (await User.collection.indexes()).map((i) => i.name);

// Recreate the pre-v2 collection: the old unique auth0Id index, none of the new ones.
beforeEach(async () => {
  await User.collection.dropIndexes();
  await User.collection.createIndex({ auth0Id: 1 }, { unique: true });
});
afterEach(async () => {
  await User.collection.deleteMany({});
  await User.collection.dropIndexes();
  await User.createIndexes();
});

describe("migrateUsersV2", () => {
  it("dry run reports and changes nothing; --apply copies, swaps indexes; a rerun is a no-op", async () => {
    await User.collection.insertMany([oldRow(1), oldRow(2), oldRow(3, { emailVerified: false })]);

    const dry = await migrateUsersV2();
    expect(dry).toMatchObject({ applied: false, toCopy: 3, duplicates: [] });
    expect(await User.collection.countDocuments({ auth0Ids: { $exists: true } })).toBe(0);
    expect(await indexNames()).toContain("auth0Id_1");

    const applied = await migrateUsersV2({ apply: true });
    expect(applied).toMatchObject({ applied: true, toCopy: 3, droppedIndexes: ["auth0Id_1"] });
    for (const row of await User.collection.find({}).toArray()) {
      expect(row.auth0Ids).toEqual([row.auth0Id]);
    }
    const names = await indexNames();
    expect(names).toEqual(expect.arrayContaining(["auth0Ids_1", "email_verified_unique"]));
    expect(names).not.toContain("auth0Id_1");

    expect(await migrateUsersV2({ apply: true })).toMatchObject({ toCopy: 0, droppedIndexes: [] });
  });

  it("two rows with one verified email: stops, lists their ids, writes nothing", async () => {
    const a = oldRow(1, { email: "same@example.com" });
    const b = oldRow(2, { email: "same@example.com" });
    const unverified = oldRow(3, { email: "same@example.com", emailVerified: false });
    await User.collection.insertMany([a, b, unverified]);

    const r = await migrateUsersV2({ apply: true });
    expect(r.applied).toBe(false);
    expect(r.duplicates).toHaveLength(1);
    expect([...r.duplicates[0]].sort()).toEqual([String(a._id), String(b._id)].sort());
    expect(await User.collection.countDocuments({ auth0Ids: { $exists: true } })).toBe(0);
    expect(await indexNames()).toContain("auth0Id_1");
  });
});

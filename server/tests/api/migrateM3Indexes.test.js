// migrate:m3-indexes: dry run reports and builds nothing; --apply builds the M3 indexes and drops the replaced
// respond-by index; a rerun is a no-op.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";
import { useTestDb } from "../helpers/testDb.js";
import { AuditLog } from "../../src/models/AuditLog.js";
import { Comment } from "../../src/models/Comment.js";
import { Flag } from "../../src/models/Flag.js";
import { Issue } from "../../src/models/Issue.js";
import { Post } from "../../src/models/Post.js";
import { migrateM3Indexes } from "../../src/services/m3MigrationService.js";

useTestDb();

const MODELS = [Post, Comment, Flag, AuditLog, Issue];
const OLD = "status_1_respondBy_1";
const NEW = "status_1_slaPausedAt_1_respondNotifiedAt_1_respondBy_1";
const names = async (model) => (await model.collection.indexes()).map((i) => i.name);

describe("migrateM3Indexes", () => {
  beforeEach(async () => {
    // createCollection: a missing collection has no indexes to drop.
    for (const model of MODELS) {
      await model.createCollection();
      await model.collection.dropIndexes();
    }
    await Issue.collection.createIndex({ status: 1, respondBy: 1 }); // what production has today
  });
  afterEach(async () => {
    await Issue.collection.dropIndex(OLD).catch(() => {});
    for (const model of MODELS) await model.createIndexes();
  });

  it("dry run lists, --apply builds and drops the old index, rerun changes nothing", async () => {
    const dry = await migrateM3Indexes();
    expect(dry.applied).toBe(false);
    expect(dry.missingIndexes.Flag).toEqual(["targetType_1_targetId_1_userId_1"]);
    expect(dry.missingIndexes.AuditLog).toContain("cityId_1_at_-1__id_-1");
    expect(dry.missingIndexes.Post).toEqual([
      "pincode_1_status_1_createdAt_-1__id_-1",
      "cityId_1_status_1_createdAt_-1__id_-1",
    ]);
    expect(dry.missingIndexes.Comment).toHaveLength(2);
    expect(dry.missingIndexes.Issue).toContain(NEW);
    expect(dry.staleIndexes).toEqual([OLD]);
    expect(await names(Flag)).toEqual(["_id_"]);
    expect(await names(Issue)).toContain(OLD);

    expect(await migrateM3Indexes({ apply: true })).toMatchObject({ applied: true });
    const flagIndex = (await Flag.collection.indexes()).find(
      (i) => i.name === "targetType_1_targetId_1_userId_1",
    );
    expect(flagIndex.unique).toBe(true);
    expect(await names(Issue)).toContain(NEW);
    expect(await names(Issue)).not.toContain(OLD);

    expect(await migrateM3Indexes({ apply: true })).toEqual({
      applied: true,
      missingIndexes: {},
      staleIndexes: [],
      duplicateFlags: 0,
    });
  });

  it("refuses --apply while duplicate flags exist, and builds nothing", async () => {
    const flag = {
      targetType: "post",
      targetId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      reason: "spam",
    };
    await Flag.collection.insertMany([{ ...flag }, { ...flag }]);

    expect((await migrateM3Indexes()).duplicateFlags).toBe(1);
    await expect(migrateM3Indexes({ apply: true })).rejects.toThrow("1 duplicate flag group(s)");
    expect(await names(Flag)).toEqual(["_id_"]);
    expect(await names(Post)).toEqual(["_id_"]);
    await Flag.collection.deleteMany({});
  });
});

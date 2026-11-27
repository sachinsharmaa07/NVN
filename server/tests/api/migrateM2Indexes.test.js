// migrate:m2-indexes: dry run reports and writes nothing; --apply builds the indexes and backfills the SLA
// fields of M1 issues; a rerun is a no-op.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useTestDb } from "../helpers/testDb.js";
import { makeIssue, seedIssueWorld, HOUR } from "../helpers/issueWorld.js";
import { Issue } from "../../src/models/Issue.js";
import { Notification } from "../../src/models/Notification.js";
import { migrateM2Indexes } from "../../src/services/m2MigrationService.js";

useTestDb();

const names = async (model) => (await model.collection.indexes()).map((i) => i.name);

describe("migrateM2Indexes", () => {
  beforeEach(async () => {
    for (const model of [Issue, Notification]) await model.collection.dropIndexes();
  });
  afterEach(async () => {
    for (const model of [Issue, Notification]) await model.createIndexes();
  });

  it("dry run lists, --apply builds and backfills, rerun changes nothing", async () => {
    const w = await seedIssueWorld();
    const t0 = new Date("2026-11-20T00:00:00Z");
    const m1 = await makeIssue(w, { createdAt: t0 });
    await Issue.collection.updateOne({ _id: m1._id }, { $unset: { atRiskAt: "", slaState: "" } });

    const dry = await migrateM2Indexes();
    expect(dry.applied).toBe(false);
    expect(dry.missingIndexes.Issue).toEqual(
      expect.arrayContaining([
        "departmentId_1_expectedBy_1_createdAt_1__id_1",
        "slaState_1_atRiskAt_1",
      ]),
    );
    expect(dry.missingIndexes.Notification).toEqual([
      "userId_1_createdAt_-1__id_-1",
      "emailedAt_1_createdAt_1",
      "createdAt_1",
    ]);
    expect(dry.issuesWithoutSla).toBe(1);
    expect(await names(Notification)).toEqual(["_id_"]);

    expect(await migrateM2Indexes({ apply: true })).toMatchObject({ applied: true });
    expect(await names(Notification)).toEqual(
      expect.arrayContaining(["userId_1_createdAt_-1__id_-1", "createdAt_1"]),
    );
    const fixed = await Issue.findById(m1._id).lean();
    expect(fixed.slaState).toBe("on_track");
    expect(fixed.atRiskAt.toISOString()).toBe(new Date(t0.getTime() + 126 * HOUR).toISOString());

    expect(await migrateM2Indexes({ apply: true })).toEqual({
      applied: true,
      missingIndexes: {},
      issuesWithoutSla: 0,
    });
  });
});

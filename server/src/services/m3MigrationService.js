// migrate:m3-indexes (M3): builds the Post, Comment, Flag and AuditLog indexes (community, moderation, a city
// admin's audit feed) and the Issue respond-by index, then drops the respond-by index it replaces. Dry run by
// default. createIndexes, never syncIndexes, so nothing we did not name is dropped. Also backfills closureType and
// reopenCount on issues from before step 4, from their own status history.
import { AuditLog } from "../models/AuditLog.js";
import { Comment } from "../models/Comment.js";
import { Flag } from "../models/Flag.js";
import { Issue } from "../models/Issue.js";
import { Post } from "../models/Post.js";
import { dropIndexIfPresent, hasIndex, indexName } from "./migrationService.js";

// Flag last: its unique build is the one that can fail on existing data.
const MODELS = [Post, Comment, AuditLog, Issue, Flag];
// Replaced by { status, slaPausedAt, respondNotifiedAt, respondBy }, which serves every respondOverdue filter.
const OLD_M3_ISSUE_INDEXES = ["status_1_respondBy_1"];

// Repeat flags (one user, one target) that got in while the unique index was missing; it cannot build over them.
async function countDuplicateFlags() {
  const [row] = await Flag.collection
    .aggregate([
      { $group: { _id: { t: "$targetType", id: "$targetId", u: "$userId" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: "groups" },
    ])
    .toArray();
  return row?.groups ?? 0;
}

// Raw driver filter (no Mongoose sanitizeFilter): rows from before step 4 have no closureType at all.
const NO_CLOSURE_FIELDS = { closureType: { $exists: false } };
const historyOf = (status) => ({
  $filter: { input: { $ifNull: ["$statusHistory", []] }, cond: { $eq: ["$$this.status", status] } },
});
// Computed per row on the server: closed by the job (role system) or by the reporter; reopens counted.
const BACKFILL = [
  {
    $set: {
      closureType: {
        $cond: [
          { $ne: ["$status", "closed"] },
          null,
          {
            $cond: [
              {
                $eq: [
                  { $getField: { field: "role", input: { $last: historyOf("closed") } } },
                  "system",
                ],
              },
              "auto_closed",
              "citizen_confirmed",
            ],
          },
        ],
      },
      reopenCount: { $size: historyOf("reopened") },
    },
  },
];

export async function migrateM3Indexes({ apply = false } = {}) {
  const report = {
    applied: false,
    missingIndexes: {},
    staleIndexes: [],
    duplicateFlags: 0,
    issuesWithoutClosure: 0,
  };
  for (const model of MODELS) {
    const { toCreate } = await model.diffIndexes();
    if (toCreate.length) report.missingIndexes[model.modelName] = toCreate.map(indexName);
  }
  for (const name of OLD_M3_ISSUE_INDEXES)
    if (await hasIndex(Issue.collection, name)) report.staleIndexes.push(name);
  report.duplicateFlags = await countDuplicateFlags();
  report.issuesWithoutClosure = await Issue.collection.countDocuments(NO_CLOSURE_FIELDS);
  if (!apply) return report;
  // Refuse before building anything: removing them also changes flagCount and auto-hide, a human decision.
  if (report.duplicateFlags) {
    throw new Error(`${report.duplicateFlags} duplicate flag group(s); resolve them, then rerun.`);
  }

  for (const model of MODELS) await model.createIndexes();
  // Drop only after the replacement exists, so the SLA job is never without an index.
  for (const name of report.staleIndexes) await dropIndexIfPresent(Issue.collection, name);
  await Issue.collection.updateMany(NO_CLOSURE_FIELDS, BACKFILL);
  report.applied = true;
  return report;
}

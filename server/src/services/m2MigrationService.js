// migrate:m2-indexes (M2): builds the Issue and Notification indexes, and gives M1 issues the SLA fields the
// job queries on (atRiskAt = 75% of the way to expectedBy, slaState on_track). Dry run by default.
import { Issue } from "../models/Issue.js";
import { Notification } from "../models/Notification.js";
import { AT_RISK_SHARE } from "../utils/expectedBy.js";

const MODELS = [Issue, Notification];
const indexName = (keys) =>
  Object.entries(keys)
    .map(([field, dir]) => `${field}_${dir}`)
    .join("_");
// Raw driver filter (no Mongoose sanitizeFilter): M1 rows have neither field.
const NO_SLA_FIELDS = { atRiskAt: { $exists: false } };

export async function migrateM2Indexes({ apply = false } = {}) {
  const report = { applied: false, missingIndexes: {}, issuesWithoutSla: 0 };
  for (const model of MODELS) {
    const { toCreate } = await model.diffIndexes();
    if (toCreate.length) report.missingIndexes[model.modelName] = toCreate.map(indexName);
  }
  report.issuesWithoutSla = await Issue.collection.countDocuments(NO_SLA_FIELDS);
  if (!apply) return report;

  for (const model of MODELS) await model.createIndexes();
  // Pipeline update: computed per row on the server, so a rerun finds nothing to change.
  await Issue.collection.updateMany(NO_SLA_FIELDS, [
    {
      $set: {
        atRiskAt: {
          $add: [
            "$createdAt",
            { $multiply: [AT_RISK_SHARE, { $subtract: ["$expectedBy", "$createdAt"] }] },
          ],
        },
        slaState: { $ifNull: ["$slaState", "on_track"] },
      },
    },
  ]);
  report.applied = true;
  return report;
}

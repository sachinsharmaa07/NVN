// GET /api/stats: public counts, no personal data. Cached in memory for 5 minutes, so a
// busy landing page costs four aggregate reads per 5 minutes, not per visit. resolved counts resolved + closed;
// verifiedFixes the ones the reporter confirmed; slaMetRate the % of resolved ones fixed by expectedBy.
import { Issue } from "../models/Issue.js";
import { CATEGORIES } from "../utils/categories.js";
import { clock } from "../utils/clock.js";
import { OPEN_STATUSES } from "../utils/issueStateMachine.js";

export const STATS_TTL_MS = 5 * 60_000;
let cache = null; // shortcut: one process (ADR 0001); a second instance keeps its own copy, fine for counts

async function compute() {
  const [total, fixes, median, open] = await Promise.all([
    Issue.estimatedDocumentCount(),
    // One pass over resolved + closed (index { status, resolvedAt }) for all three fix counts.
    Issue.aggregate([
      { $match: { status: { $in: ["resolved", "closed"] } } },
      {
        $group: {
          _id: null,
          n: { $sum: 1 },
          verified: { $sum: { $cond: [{ $eq: ["$closureType", "citizen_confirmed"] }, 1, 0] } },
          // $gt null: in aggregation null sorts before every date, so a missing resolvedAt would count as on time.
          onTime: {
            $sum: {
              $cond: [
                {
                  $and: [{ $gt: ["$resolvedAt", null] }, { $lte: ["$resolvedAt", "$expectedBy"] }],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    // $median needs MongoDB 7.0+ (Atlas and the test server are 7+).
    Issue.aggregate([
      { $match: { resolvedAt: { $ne: null } } },
      {
        $group: {
          _id: null,
          hours: {
            $median: {
              input: { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3_600_000] },
              method: "approximate",
            },
          },
        },
      },
    ]),
    Issue.aggregate([
      { $match: { status: { $in: OPEN_STATUSES } } },
      { $group: { _id: "$category", n: { $sum: 1 } } },
    ]),
  ]);
  const openByCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const { _id, n } of open) openByCategory[_id] = n;
  const hours = median[0]?.hours;
  const { n = 0, verified = 0, onTime = 0 } = fixes[0] ?? {};
  return {
    totalReports: total,
    resolved: n,
    verifiedFixes: verified,
    slaMetRate: n ? Math.round((onTime / n) * 1000) / 10 : null,
    medianResolutionHours: hours == null ? null : Math.round(hours * 10) / 10,
    openByCategory,
  };
}

export async function getStats() {
  const now = clock.now().getTime();
  if (!cache || now - cache.at >= STATS_TTL_MS) cache = { at: now, value: await compute() };
  return cache.value;
}

/** Tests only: forget the cached answer. */
export const clearStatsCache = () => {
  cache = null;
};

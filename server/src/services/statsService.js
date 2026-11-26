// GET /api/stats (M2 step 9): public counts, no personal data. Cached in memory for 5 minutes, so a
// busy landing page costs four aggregate reads per 5 minutes, not per visit.
import { Issue } from "../models/Issue.js";
import { CATEGORIES } from "../utils/categories.js";
import { clock } from "../utils/clock.js";
import { OPEN_STATUSES } from "../utils/issueStateMachine.js";
import { trusted } from "./adminUserSupport.js";

export const STATS_TTL_MS = 5 * 60_000;
let cache = null; // shortcut: one process (ADR 0001); a second instance keeps its own copy, fine for counts

async function compute() {
  const [total, resolved, median, open] = await Promise.all([
    Issue.estimatedDocumentCount(),
    Issue.countDocuments({ status: trusted({ $in: ["resolved", "closed"] }) }),
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
  return {
    totalReports: total,
    resolved,
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

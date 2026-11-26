// SLA policies: the national default seed (scripts/seedSlaPolicies.js). Inserts only what is missing
// ($setOnInsert), so a rerun creates 0 and an edited default is never overwritten.
import { SlaPolicy } from "../models/SlaPolicy.js";
import { DEFAULT_SLA_HOURS } from "../utils/categories.js";

export async function seedSlaPolicies({ apply = false } = {}) {
  const have = new Set(
    (await SlaPolicy.find({ cityId: null }, "category").lean()).map((p) => p.category),
  );
  const missing = Object.entries(DEFAULT_SLA_HOURS).filter(([category]) => !have.has(category));
  if (apply && missing.length) {
    await SlaPolicy.bulkWrite(
      missing.map(([category, hours]) => ({
        updateOne: {
          filter: { category, cityId: null },
          update: { $setOnInsert: hours },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  return { created: missing.length, applied: apply };
}

// One-off, safe to rerun: builds the M1 indexes (pincodes, waitlists, cities, departments, category mappings),
// drops the stale city index stateCode_1_name_1, and gives cities without a status the default "onboarding".
// npm run migrate:m1-indexes -w server            dry run: reports, changes nothing
// npm run migrate:m1-indexes -w server -- --apply  writes
// Exit codes: 0 done (or dry run), 1 error.
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { migrateM1Indexes } from "../src/services/migrationService.js";

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  await connectDb(config.MONGODB_URI);
  try {
    const r = await migrateM1Indexes({ apply });
    const missing = Object.entries(r.missingIndexes).map(
      ([m, names]) => `${m}: ${names.join(", ")}`,
    );
    console.log(`Missing indexes: ${missing.join("; ") || "none"}.`);
    console.log(`Cities without status: ${r.citiesWithoutStatus}.`);
    console.log(
      `Stale indexes ${apply ? "dropped" : "to drop"}: ${r.staleIndexes.join(", ") || "none"}.`,
    );
    console.log(apply ? "Indexes built; statuses set." : "Dry run. Rerun with --apply to write.");
    return 0;
  } finally {
    await disconnectDb();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Unexpected error:", err.message);
    process.exitCode = 1;
  });

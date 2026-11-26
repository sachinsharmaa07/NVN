// One-off, safe to rerun: builds the M2 Issue and Notification indexes and backfills atRiskAt and
// slaState on M1 issues.
// npm run migrate:m2-indexes -w server            dry run: reports, changes nothing
// npm run migrate:m2-indexes -w server -- --apply  writes
// Exit codes: 0 done (or dry run), 1 error.
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { migrateM2Indexes } from "../src/services/m2MigrationService.js";

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  await connectDb(config.MONGODB_URI);
  try {
    const r = await migrateM2Indexes({ apply });
    const missing = Object.entries(r.missingIndexes).map(
      ([m, names]) => `${m}: ${names.join(", ")}`,
    );
    console.log(`Missing indexes: ${missing.join("; ") || "none"}.`);
    console.log(`Issues without SLA fields: ${r.issuesWithoutSla}.`);
    console.log(apply ? "Indexes built; SLA fields set." : "Dry run. Rerun with --apply to write.");
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

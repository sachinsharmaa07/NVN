// One-off, safe to rerun: builds the M3 Post, Comment, Flag and AuditLog indexes and the new Issue respond-by
// index, then drops the respond-by index it replaces.
// npm run migrate:m3-indexes -w server            dry run: reports, changes nothing
// npm run migrate:m3-indexes -w server -- --apply  writes
// Exit codes: 0 done (or dry run), 1 error.
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { migrateM3Indexes } from "../src/services/m3MigrationService.js";

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  await connectDb(config.MONGODB_URI);
  try {
    const r = await migrateM3Indexes({ apply });
    const missing = Object.entries(r.missingIndexes).map(
      ([m, names]) => `${m}: ${names.join(", ")}`,
    );
    console.log(`Missing indexes: ${missing.join("; ") || "none"}.`);
    console.log(`Stale indexes: ${r.staleIndexes.join(", ") || "none"}.`);
    console.log(`Duplicate flag groups (block --apply): ${r.duplicateFlags}.`);
    console.log(
      apply ? "Indexes built; stale indexes dropped." : "Dry run. Rerun with --apply to write.",
    );
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

// One-off, safe to rerun: copy each user's auth0Id into the auth0Ids array and build the new
// indexes (unique auth0Ids; unique email among verified rows).
// npm run migrate:users-v2 -w server            dry run: reports, changes nothing
// npm run migrate:users-v2 -w server -- --apply  writes
// Exit codes: 0 done (or dry run), 1 error, 2 duplicate verified emails (nothing changed).
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { migrateUsersV2 } from "../src/services/migrationService.js";

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  await connectDb(config.MONGODB_URI);
  try {
    const r = await migrateUsersV2({ apply });
    if (r.duplicates.length > 0) {
      console.error(`Stopped: ${r.duplicates.length} verified emails are shared. Nothing changed.`);
      for (const ids of r.duplicates) console.error(`  user ids: ${ids.join(", ")}`);
      return 2;
    }
    if (!apply) {
      console.log(`Dry run: ${r.toCopy} users would get auth0Ids. Rerun with --apply to write.`);
      return 0;
    }
    console.log(`auth0Ids copied for ${r.toCopy} users.`);
    console.log(
      `Old indexes dropped: ${r.droppedIndexes.join(", ") || "none"}. New indexes created.`,
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

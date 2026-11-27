// One-off, safe to rerun: remove the old auth0Id field that migrate:users-v2 kept for rollback, only on rows
// where it is already in auth0Ids. Rows not yet copied are left alone (run migrate:users-v2 first).
// npm run migrate:users-v3 -w server            dry run: reports, changes nothing
// npm run migrate:users-v3 -w server -- --apply  writes
// Exit codes: 0 done (or dry run), 1 error.
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { migrateUsersV3 } from "../src/services/migrationService.js";

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  await connectDb(config.MONGODB_URI);
  try {
    const r = await migrateUsersV3({ apply });
    if (r.notCopied > 0) {
      console.log(
        `${r.notCopied} users still have an auth0Id not in auth0Ids: run migrate:users-v2 first.`,
      );
    }
    console.log(
      apply
        ? `Removed the old auth0Id from ${r.toRemove} users.`
        : `Dry run: ${r.toRemove} users would lose the old auth0Id. Rerun with --apply to write.`,
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

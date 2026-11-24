// One-off, safe to rerun: migrate the users collection to the Phase 1 shape and build indexes.
// npm run migrate:users-v1 -w server. Exit codes: 0 done, 1 error.
// Production runs with autoIndex off, so run this after each deploy that changes indexes.
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { migrateUsersV1 } from "../src/services/migrationService.js";

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  await connectDb(config.MONGODB_URI);
  try {
    const r = await migrateUsersV1();
    console.log(
      `verified -> emailVerified: ${r.renamed} renamed, ${r.leftoverVerifiedRemoved} old fields removed.`,
    );
    console.log(`status set to active: ${r.statusSet}.`);
    console.log(
      `Old indexes dropped: ${r.droppedIndexes.join(", ") || "none"}. New indexes created.`,
    );
    console.log(
      `Rows breaking the scope rules: ${r.violations.length} (not changed; fix by hand).`,
    );
    for (const v of r.violations.slice(0, 50)) console.log(`  ${v.id}: ${v.problems.join("; ")}`);
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

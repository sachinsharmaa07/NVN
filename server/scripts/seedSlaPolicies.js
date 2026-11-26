// Inserts the national SLA defaults (decision M1-10), one per category. Only inserts what is missing.
// npm run seed:sla -w server             dry run: prints counts only
// npm run seed:sla -w server -- --apply  writes
// Exit codes: 0 done (or dry run), 1 error.
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { seedSlaPolicies } from "../src/services/slaService.js";

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  await connectDb(config.MONGODB_URI);
  try {
    const r = await seedSlaPolicies({ apply });
    console.log(`National SLA policies ${apply ? "created" : "to create"}: ${r.created}.`);
    if (!apply) console.log("Dry run. Rerun with --apply to write.");
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

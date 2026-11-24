// Sets Auth0's mfa_required flag from our database for every user (true for level >= 4, false below).
// Safe to rerun. Use it after an Auth0 outage left a flag out of step. npm run sync:mfa-flags -w server
// Exit codes: 0 all synced, 1 unexpected or some users failed.
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { syncMfaFlags } from "../src/services/adminUserService.js";

async function main() {
  if (!config.MONGODB_URI || !config.AUTH0_M2M_CLIENT_ID || !config.AUTH0_M2M_CLIENT_SECRET) {
    console.error("Set MONGODB_URI, AUTH0_M2M_CLIENT_ID and AUTH0_M2M_CLIENT_SECRET.");
    return 1;
  }
  await connectDb(config.MONGODB_URI);
  try {
    const t = await syncMfaFlags();
    console.log(
      `Users ${t.total}: flag set ${t.required}, cleared ${t.cleared}, failed ${t.failed}.`,
    );
    return t.failed > 0 ? 1 : 0;
  } finally {
    await disconnectDb();
  }
}

main()
  .then((code) => {
    process.exitCode = code; // not process.exit(): lets pending log output flush
  })
  .catch((err) => {
    console.error("Unexpected error:", err.message);
    process.exitCode = 1;
  });

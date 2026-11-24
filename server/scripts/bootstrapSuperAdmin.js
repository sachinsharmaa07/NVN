// One-off: promote the account whose email is SUPER_ADMIN_EMAIL to super_admin.
// Run by hand: npm run bootstrap:super-admin -w server. Never at start-up and never from a route.
// Exit codes: 0 done (or already done), 1 unexpected, 2 no such user, 3 several users with that email,
// 4 email not verified, 5 Auth0 flag could not be set, 6 account suspended, 7 another super_admin
// exists (pass --force to add a second one), 8 the user changed while promoting (run it again).
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { promoteToSuperAdmin } from "../src/services/adminUserService.js";

const EXIT = {
  BOOTSTRAP_NOT_FOUND: 2,
  BOOTSTRAP_AMBIGUOUS: 3,
  BOOTSTRAP_UNVERIFIED: 4,
  BOOTSTRAP_PROVIDER_FAILED: 5,
  BOOTSTRAP_SUSPENDED: 6,
  BOOTSTRAP_OTHER_EXISTS: 7,
  BOOTSTRAP_CONFLICT: 8,
};

// a***@example.com: enough to recognise it, not enough to harvest it from a terminal log.
const mask = (email) => email.replace(/^(.).*(@.*)$/, "$1***$2");

async function main() {
  const email = config.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (
    !email ||
    !config.MONGODB_URI ||
    !config.AUTH0_M2M_CLIENT_ID ||
    !config.AUTH0_M2M_CLIENT_SECRET
  ) {
    console.error(
      "Set SUPER_ADMIN_EMAIL, MONGODB_URI, AUTH0_M2M_CLIENT_ID and AUTH0_M2M_CLIENT_SECRET.",
    );
    return 1;
  }
  await connectDb(config.MONGODB_URI);
  try {
    const r = await promoteToSuperAdmin(email, { force: process.argv.includes("--force") });
    if (r.outcome === "unchanged") {
      console.log(
        `${mask(email)} (${r.userId}) is already super_admin. Auth0 MFA flag re-checked. No change.`,
      );
    } else {
      console.log(
        `Promoted ${mask(email)} (${r.userId}): ${r.before} -> ${r.after}. Audit id ${r.auditId}.`,
      );
    }
    console.log("Sign out and sign in again, then enroll two-step verification (MFA).");
    return 0;
  } catch (err) {
    const code = EXIT[err.code];
    if (!code) throw err;
    const ids = err.details?.ids ? ` User ids: ${err.details.ids.join(", ")}.` : "";
    console.error(`Refused (${err.code}): ${err.message}${ids} Nothing was changed.`);
    return code;
  } finally {
    await disconnectDb();
  }
}

main()
  .then((code) => {
    process.exitCode = code; // not process.exit(): lets pending log output flush
  })
  .catch((err) => {
    console.error("Unexpected error:", err.message); // message only: never a token or secret
    process.exitCode = 1;
  });

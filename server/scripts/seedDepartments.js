// Gives every city the default departments (Roads, Sanitation, Electrical, Water, Drainage) and the
// category map (decision M1-9). Only inserts what is missing: never overwrites an admin's change.
// npm run seed:departments -w server                     dry run: prints counts only
// npm run seed:departments -w server -- --apply          writes
// npm run seed:departments -w server -- --apply --city PB-KAPURTHALA   one city only
// Run import:pincodes first (it creates the cities). Exit codes: 0 done (or dry run), 1 error.
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { seedDepartments } from "../src/services/departmentSeedService.js";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  await connectDb(config.MONGODB_URI);
  try {
    const started = Date.now();
    const r = await seedDepartments({ apply, cityCode: arg("--city") });
    console.log(`Cities: ${r.cities}. Departments created: ${r.departmentsCreated}.`);
    console.log(`Category mappings created: ${r.mappingsCreated}.`);
    console.log(`Took ${((Date.now() - started) / 1000).toFixed(1)} s.`);
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

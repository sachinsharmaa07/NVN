// Loads data/pincodes.csv (data.gov.in All India Pincode Directory) into `pincodes`. Safe to rerun.
// npm run import:pincodes -w server                              dry run: prints counts only
// npm run import:pincodes -w server -- --apply                   writes
// npm run import:pincodes -w server -- --apply --city PHG        also marks the pilot city served
// Optional: --file <path to csv>. Exit codes: 0 done (or dry run), 1 error.
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { importPincodes } from "../src/services/pincodeImportService.js";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const DEFAULT_FILE = fileURLToPath(new URL("../../data/pincodes.csv", import.meta.url));

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  const input = createReadStream(arg("--file") ?? DEFAULT_FILE);
  await connectDb(config.MONGODB_URI);
  try {
    const r = await importPincodes({ input, apply, cityCode: arg("--city") });
    console.log(`Rows: ${r.rows} (bad, skipped: ${r.badRows}). Pincodes: ${r.pincodes}.`);
    console.log(`Inserted: ${r.inserted}. Updated: ${r.updated}. Unchanged: ${r.unchanged}.`);
    if (r.missingCityPins?.length)
      console.log(`City pincodes not in the CSV: ${r.missingCityPins.join(", ")}`);
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

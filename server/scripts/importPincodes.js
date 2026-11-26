// Loads the pincode directory into `pincodes` and creates one City per (state, district). Safe to rerun.
// npm run import:pincodes -w server                                   dry run, data/pincodes.tsv (GeoNames)
// npm run import:pincodes -w server -- --apply                        writes
// npm run import:pincodes -w server -- --apply --city PB-KAPURTHALA   only that district city's pincodes
// Optional: --format geonames|csv (csv = data.gov.in, data/pincodes.csv), --file <path>.
// Exit codes: 0 done (or dry run), 1 error.
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { importPincodes } from "../src/services/pincodeImportService.js";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const DEFAULT_FILES = { geonames: "../../data/pincodes.tsv", csv: "../../data/pincodes.csv" };

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  const format = arg("--format") ?? "geonames";
  if (!DEFAULT_FILES[format]) {
    console.error("--format must be geonames or csv.");
    return 1;
  }
  const file = arg("--file") ?? fileURLToPath(new URL(DEFAULT_FILES[format], import.meta.url));
  const input = createReadStream(file);
  await connectDb(config.MONGODB_URI);
  try {
    const started = Date.now();
    const r = await importPincodes({ input, format, apply, cityCode: arg("--city") });
    console.log(`Rows: ${r.rows} (bad, skipped: ${r.badRows}). Pincodes: ${r.pincodes}.`);
    if (r.unknownStates.length) console.log(`Unknown state names: ${r.unknownStates.join(", ")}`);
    console.log(`Cities created: ${r.citiesCreated}. Cities updated: ${r.citiesUpdated}.`);
    console.log(
      `Pincodes inserted: ${r.inserted}. Updated: ${r.updated}. Unchanged: ${r.unchanged}.`,
    );
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

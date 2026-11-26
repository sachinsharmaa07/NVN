// Sets boundary, boundarySource and centroid on pincodes from a GeoJSON FeatureCollection. Safe to rerun.
// Run importPincodes first: features whose pincode has no row are reported, not created.
// npm run import:boundaries -w server                     dry run (data/boundaries/phagwara.geojson)
// npm run import:boundaries -w server -- --apply          writes
// Optional: --file <path>, --source manual|aikosh (default manual). Exit codes: 0 done, 1 error.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { importBoundaries } from "../src/services/boundaryImportService.js";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const DEFAULT_FILE = fileURLToPath(
  new URL("../../data/boundaries/phagwara.geojson", import.meta.url),
);

async function main() {
  if (!config.MONGODB_URI) {
    console.error("Set MONGODB_URI.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  // A pilot city's polygons are small, so one read is fine (unlike the national CSV).
  const geojson = JSON.parse(await readFile(arg("--file") ?? DEFAULT_FILE, "utf8"));
  await connectDb(config.MONGODB_URI);
  try {
    const r = await importBoundaries({ geojson, apply, source: arg("--source") ?? "manual" });
    console.log(`Features: ${r.features}. Updated: ${r.updated}. Unchanged: ${r.unchanged}.`);
    for (const { pin, problems } of r.invalid)
      console.log(`Invalid ${pin || "(no pin)"}: ${problems.join("; ")}`);
    if (r.unmatched.length) console.log(`No pincode row for: ${r.unmatched.join(", ")}`);
    console.log(
      `Served pincodes with no polygon: ${r.servedWithoutBoundary.join(", ") || "none"}.`,
    );
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

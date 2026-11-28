// Bundle budget (HLD §7): the entry script plus every modulepreload in dist/index.html must stay under
// CRITICAL_KB gzip, and every lazy page chunk under 60 KB. Runs after `vite build`; exits 1 when over.
// 165, not HLD's 150: what remains is react-dom, react-router, TanStack Query, Motion core and
// tailwind-merge, which the shell needs at first paint (docs/DECISIONS.md, FE-PERF-1).
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

const CRITICAL_KB = 165;
const LAZY_KB = 60;
const dist = join(import.meta.dirname, "..", "dist");

// Page chunks are named after their page file (pages/Landing/index.jsx -> Landing-<hash>.js).
// Vendor chunks such as the lazy Auth0 SDK are not pages and are not held to the page budget.
const pagesDir = join(import.meta.dirname, "..", "src", "pages");
const pageNames = new Set(
  readdirSync(pagesDir, { recursive: true })
    .filter((file) => file.endsWith(".jsx") && !file.includes(".test."))
    .map((file) =>
      basename(file) === "index.jsx" ? basename(dirname(file)) : basename(file, ".jsx"),
    ),
);
const isPage = (file) => pageNames.has(basename(file).replace(/-[\w-]{8}\.js$/, ""));

const kb = (file) => gzipSync(readFileSync(join(dist, file))).length / 1024;
const html = readFileSync(join(dist, "index.html"), "utf8");
const critical = [
  ...html.matchAll(/<script[^>]*type="module"[^>]*src="\/([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="\/([^"]+\.js)"/g),
].map((match) => match[1]);

const rows = critical.map((file) => [file, kb(file)]);
const total = rows.reduce((sum, [, size]) => sum + size, 0);
console.log("Critical path (entry + modulepreload), gzip KB:");
for (const [file, size] of rows) console.log(`  ${size.toFixed(1).padStart(6)}  ${file}`);
console.log(`  ${total.toFixed(1).padStart(6)}  total (budget ${CRITICAL_KB})`);

const lazy = readdirSync(join(dist, "assets"))
  .map((name) => `assets/${name}`)
  .filter((file) => file.endsWith(".js") && !critical.includes(file))
  .map((file) => [file, kb(file)])
  .sort((a, b) => b[1] - a[1]);
const overLazy = lazy.filter(([file, size]) => isPage(file) && size > LAZY_KB);
console.log(`Largest lazy chunks, gzip KB (pages: budget ${LAZY_KB} each):`);
for (const [file, size] of lazy.slice(0, 8))
  console.log(`  ${size.toFixed(1).padStart(6)}  ${file}${isPage(file) ? "  (page)" : ""}`);

if (total > CRITICAL_KB || overLazy.length > 0) {
  if (total > CRITICAL_KB)
    console.error(`Critical path ${total.toFixed(1)} KB > ${CRITICAL_KB} KB`);
  for (const [file, size] of overLazy)
    console.error(`${file} ${size.toFixed(1)} KB > ${LAZY_KB} KB`);
  process.exit(1);
}

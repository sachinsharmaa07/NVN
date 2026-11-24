// Loads .env, validates every setting with Zod, and exports one frozen `config` object.
// The rest of the server reads settings ONLY from here, never from process.env directly.
import dotenv from "dotenv";
import { z } from "zod";

// quiet: true stops dotenv from printing its "injected env" banner on start-up.
// Existing process.env values win over .env, so CI secrets and test settings are not overwritten.
dotenv.config({ quiet: true });

// An empty value in .env (KEY=) should behave like a missing key, so defaults and "required" work.
const optional = (schema) => z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];

const mongoUri = z
  .string()
  .regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://");

const envSchema = z.object({
  NODE_ENV: optional(z.enum(["development", "test", "production"])).default("development"),
  PORT: optional(z.coerce.number().int().min(1).max(65535)).default(5000),
  MONGODB_URI: optional(mongoUri),
  MONGODB_URI_TEST: optional(mongoUri),
  // Reduced to its origin ("https://a.com/" -> "https://a.com") so it matches the browser's Origin header.
  CLIENT_URL: optional(z.url())
    .default("http://localhost:5173")
    .transform((v) => new URL(v).origin),
  LOG_LEVEL: optional(z.enum(LOG_LEVELS)).default("info"),
  // How many proxies sit in front of the API (0 locally, usually 1 on Render or behind Nginx).
  // Without it the rate limiter sees every user as the proxy's IP and limits them all together.
  TRUST_PROXY: optional(z.coerce.number().int().min(0).max(5)).default(0),
});

// The test database may be wiped by tests, so refuse anything that could be the real one.
function testDbProblems(raw) {
  const testUri = raw.MONGODB_URI_TEST;
  if (!testUri) return [];
  if (testUri === raw.MONGODB_URI) return ["MONGODB_URI_TEST: must not be the same as MONGODB_URI"];
  // Database name = the URI path after the host, before any "?options".
  const dbName = testUri.split("?")[0].split("/")[3] ?? "";
  if (!dbName.endsWith("_test")) {
    return ["MONGODB_URI_TEST: database name must end in _test (e.g. nivaran_test)"];
  }
  return [];
}

/**
 * Pure: validates a raw env object (usually process.env) and never exits.
 * @returns {{ ok: true, config: object } | { ok: false, problems: string[] }}
 */
export function parseEnv(raw) {
  const result = envSchema.safeParse(raw);
  // Turn each Zod issue into a line like "PORT: Too big: expected number to be <=65535".
  const problems = result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".") || "(env)"}: ${issue.message}`);

  // MONGODB_URI is needed to run the app, but tests use MONGODB_URI_TEST (or no DB at all).
  // Checked here rather than in a Zod refine so it is reported together with every other problem.
  const nodeEnv = result.success ? result.data.NODE_ENV : raw.NODE_ENV;
  if (nodeEnv !== "test" && !raw.MONGODB_URI) problems.push("MONGODB_URI: required");
  // In production a forgotten setting must fail loudly instead of falling back to a local default.
  if (nodeEnv === "production") {
    if (!raw.CLIENT_URL) problems.push("CLIENT_URL: required in production");
    if (!raw.TRUST_PROXY) problems.push("TRUST_PROXY: required in production (number of proxies)");
  }
  problems.push(...testDbProblems(raw));

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, config: Object.freeze(result.data) };
}

const parsed = parseEnv(process.env);
if (!parsed.ok) {
  // The logger depends on config, so plain stderr is the only safe output here.
  console.error("Invalid environment settings (see server/.env.example):");
  for (const problem of parsed.problems) console.error(`  - ${problem}`);
  // Fail fast: running with bad settings would only fail later in a more confusing way.
  process.exit(1); // eslint-disable-line n/no-process-exit -- start-up check, see comment above
}

export const config = parsed.config;

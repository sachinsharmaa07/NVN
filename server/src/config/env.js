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
  // Auth0 tenant host only, no https:// and no slash (e.g. nivaran.eu.auth0.com). Not needed until
  // you create the tenant: without it the API answers 503 AUTH_NOT_CONFIGURED on protected routes.
  AUTH0_DOMAIN: optional(
    z.string().regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i, "host name only, without https://"),
  ),
  // The "API identifier" you set in Auth0 (e.g. https://api.nivaran.in). It is a name, not a URL we call.
  AUTH0_AUDIENCE: optional(z.string().min(1)),
  // How far the token's exp/nbf may be off our clock, in seconds. Explicit, never above 30.
  AUTH_CLOCK_TOLERANCE_SECONDS: optional(z.coerce.number().int().min(0).max(30)).default(5),
  // Auth0 Machine-to-Machine app for the Management API (resend verification, MFA flag). Server only,
  // never in client/.env. Scopes: update:users, update:users_app_metadata. The secret is never logged.
  AUTH0_M2M_CLIENT_ID: optional(z.string().min(1)),
  AUTH0_M2M_CLIENT_SECRET: optional(z.string().min(1)),
  // Email of the first super admin; only scripts/bootstrapSuperAdmin.js reads it.
  SUPER_ADMIN_EMAIL: optional(
    z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email()),
  ),
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
    // "0" is a set value but wrong behind a proxy: every user would share the proxy's IP rate-limit bucket.
    if (!(Number(raw.TRUST_PROXY) >= 1)) {
      problems.push("TRUST_PROXY: required in production, 1 or more (exact number of proxies)");
    }
    if (!raw.AUTH0_DOMAIN) problems.push("AUTH0_DOMAIN: required in production");
    if (!raw.AUTH0_AUDIENCE) problems.push("AUTH0_AUDIENCE: required in production");
    if (!raw.AUTH0_M2M_CLIENT_ID) problems.push("AUTH0_M2M_CLIENT_ID: required in production");
    if (!raw.AUTH0_M2M_CLIENT_SECRET)
      problems.push("AUTH0_M2M_CLIENT_SECRET: required in production");
  } else if (Boolean(raw.AUTH0_M2M_CLIENT_ID) !== Boolean(raw.AUTH0_M2M_CLIENT_SECRET)) {
    // Half a credential pair is always a mistake; say so at start-up, not on the first resend.
    problems.push("AUTH0_M2M_CLIENT_ID and AUTH0_M2M_CLIENT_SECRET: set both or neither");
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

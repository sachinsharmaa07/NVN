// A34: the real bootstrap script, run as a child process against the test database.
// Only the network edge to Auth0 is replaced (helpers/fakeAuth0Fetch.js, preloaded into the child).
import { describe, it, expect, beforeEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inject } from "vitest";
import { useTestDb, seedWorld, seedUser } from "../helpers/testDb.js";
import { User } from "../../src/models/User.js";
import { AuditLog } from "../../src/models/AuditLog.js";

useTestDb();

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL("../../scripts/bootstrapSuperAdmin.js", import.meta.url));
const PRELOAD = fileURLToPath(new URL("../helpers/fakeAuth0Fetch.js", import.meta.url));
const SECRET = "m2m-secret-do-not-print";
const EMAIL = "Sachin@Example.com";

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-test-"));
});

/** Runs the script. cwd is an empty temp dir so no .env file can be picked up. */
async function bootstrap({ email = EMAIL, mode = "ok", extraEnv = {} } = {}) {
  const logFile = path.join(dir, "auth0.log");
  fs.writeFileSync(logFile, "");
  const env = {
    PATH: process.env.PATH,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    MONGODB_URI: inject("mongo").uri,
    AUTH0_DOMAIN: "tenant.test",
    AUTH0_M2M_CLIENT_ID: "m2m-id",
    AUTH0_M2M_CLIENT_SECRET: SECRET,
    FAKE_AUTH0_LOG: logFile,
    FAKE_AUTH0_MODE: mode,
    ...(email ? { SUPER_ADMIN_EMAIL: email } : {}),
    ...extraEnv,
  };
  let result;
  try {
    const { stdout, stderr } = await run(process.execPath, ["--import", PRELOAD, SCRIPT], {
      cwd: dir,
      env,
      timeout: 60000,
    });
    result = { code: 0, stdout, stderr };
  } catch (err) {
    result = { code: err.code, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
  const calls = fs
    .readFileSync(logFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((c) => c.path.startsWith("/api/v2/users/"));
  return { ...result, flagCalls: calls };
}

const row = (user) => User.collection.findOne({ _id: user._id });
const audits = () => AuditLog.collection.find({}).toArray();
const verifiedUser = (extra = {}, scope = {}, role = "citizen") =>
  seedUser(role, scope, { email: EMAIL.toLowerCase(), emailVerified: true, ...extra });

describe("A34 bootstrap super admin", () => {
  it("A34 first run: user becomes super_admin, exactly one system AuditLog, Auth0 flag set for that user", async () => {
    const user = await verifiedUser();
    const r = await bootstrap();
    expect(r.code).toBe(0);
    expect(await row(user)).toMatchObject({ role: "super_admin" });
    const logs = await audits();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorType: "system",
      actorLabel: "script:bootstrap-super-admin",
      action: "user.bootstrap_super_admin",
      targetId: user._id,
      reason: "bootstrap SUPER_ADMIN_EMAIL",
    });
    expect(logs[0].actorId ?? null).toBeNull();
    expect(r.flagCalls).toEqual([
      {
        method: "PATCH",
        path: `/api/v2/users/${user.auth0Id}`,
        app_metadata: { mfa_required: true },
      },
    ]);
  });

  it("A34 prints what it changed, with the email masked, and never a secret", async () => {
    const user = await verifiedUser();
    const r = await bootstrap();
    expect(r.stdout).toContain(String(user._id));
    expect(r.stdout).toMatch(/citizen -> super_admin/);
    expect(r.stdout).toMatch(/sign out and sign in/i);
    for (const text of [r.stdout, r.stderr]) {
      expect(text).not.toContain("sachin@example.com");
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain("fake-m2m-token");
    }
  });

  it("A34 second run: no change, no second AuditLog, exit 0, the flag is re-asserted", async () => {
    const user = await verifiedUser();
    await bootstrap();
    const second = await bootstrap();
    expect(second.code).toBe(0);
    expect(await audits()).toHaveLength(1);
    expect((await row(user)).role).toBe("super_admin");
    expect(second.flagCalls).toHaveLength(1);
    expect(second.stdout).toMatch(/already super_admin/i);
  });

  it("A34 scope fields are cleared when a scoped user is promoted", async () => {
    const { cityA, deptA1 } = await seedWorld();
    const user = await verifiedUser({}, { cityId: cityA._id, departmentId: deptA1._id }, "staff");
    expect((await bootstrap()).code).toBe(0);
    const after = await row(user);
    expect(after.role).toBe("super_admin");
    expect(after.cityId ?? null).toBeNull();
    expect(after.departmentId ?? null).toBeNull();
  });

  it("A34 no such user: refuses (exit 2), creates nobody, writes nothing, calls nobody", async () => {
    const r = await bootstrap();
    expect(r.code).toBe(2);
    expect(await User.collection.countDocuments({})).toBe(0);
    expect(await audits()).toHaveLength(0);
    expect(r.flagCalls).toHaveLength(0);
    expect(r.stderr).toMatch(/sign in once first|no user/i);
  });

  it("A34 unverified email: refuses (exit 4), role unchanged, no audit, no Auth0 call", async () => {
    const user = await verifiedUser({ emailVerified: false });
    const r = await bootstrap();
    expect(r.code).toBe(4);
    expect((await row(user)).role).toBe("citizen");
    expect(await audits()).toHaveLength(0);
    expect(r.flagCalls).toHaveLength(0);
  });

  it("A34 a suspended account: refuses (exit 6)", async () => {
    const other = await seedUser("citizen");
    const user = await verifiedUser({
      status: "suspended",
      suspendedReason: "spam",
      suspendedAt: new Date(),
      suspendedBy: other._id,
    });
    const r = await bootstrap();
    expect(r.code).toBe(6);
    expect((await row(user)).role).toBe("citizen");
  });

  it("A34 two accounts with that email: refuses (exit 3), lists both ids, changes nothing", async () => {
    const a = await verifiedUser();
    const b = await verifiedUser();
    const r = await bootstrap();
    expect(r.code).toBe(3);
    expect(r.stderr).toContain(String(a._id));
    expect(r.stderr).toContain(String(b._id));
    expect((await row(a)).role).toBe("citizen");
    expect((await row(b)).role).toBe("citizen");
    expect(await audits()).toHaveLength(0);
  });

  it("A34 Auth0 unreachable: exit 5 and nothing is written", async () => {
    const user = await verifiedUser();
    const r = await bootstrap({ mode: "down" });
    expect(r.code).toBe(5);
    expect((await row(user)).role).toBe("citizen");
    expect(await audits()).toHaveLength(0);
    expect(r.stderr + r.stdout).not.toContain(SECRET);
  });

  it("A34 SUPER_ADMIN_EMAIL not set: exit 1 and nothing happens", async () => {
    const user = await verifiedUser();
    const r = await bootstrap({ email: null });
    expect(r.code).toBe(1);
    expect((await row(user)).role).toBe("citizen");
    expect(r.flagCalls).toHaveLength(0);
  });

  it("A34 only the exact email is promoted, other users are untouched", async () => {
    const target = await verifiedUser();
    const bystander = await seedUser(
      "citizen",
      {},
      { email: "other@example.com", emailVerified: true },
    );
    await bootstrap();
    expect((await row(target)).role).toBe("super_admin");
    expect((await row(bystander)).role).toBe("citizen");
  });
});

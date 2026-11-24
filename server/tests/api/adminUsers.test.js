// Admin user management end to end: permissions, scope (404 not 403), level rules, audit rows,
// Auth0 flag ordering, suspension taking effect at once. Real token check, real MongoDB (replica set).
// Only the Auth0 Management API client is replaced.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, seedWorld, seedUser, tokenFor, rawUpdate, bearer } from "../helpers/testDb.js";
import { resetMgmt, mfaCalls, failNext, request as mgmtRequest } from "../helpers/mgmtMock.js";
import { User } from "../../src/models/User.js";
import { AuditLog } from "../../src/models/AuditLog.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);
vi.mock("../../src/services/auth0ManagementClient.js", async (orig) =>
  (await import("../helpers/mgmtMock.js")).clientModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
// A fresh app per test: its global per-IP limiter (300 requests) must not add up over the whole file.
let app;
beforeEach(() => {
  app = createApp();
});

useFakeAuth0();
useTestDb();
beforeEach(resetMgmt);

const auditRows = () => AuditLog.collection.find({}).sort({ at: 1 }).toArray();
const auditCount = () => AuditLog.collection.countDocuments({});
const row = (user) => User.collection.findOne({ _id: user._id });
const roleOf = async (user) => (await row(user)).role;
const patchRole = (actor, targetId, body, claims) =>
  request(app)
    .patch(`/api/admin/users/${targetId}/role`)
    .set(bearer(tokenFor(actor, claims)))
    .send(body);
const patchStatus = (actor, targetId, body, claims) =>
  request(app)
    .patch(`/api/admin/users/${targetId}/status`)
    .set(bearer(tokenFor(actor, claims)))
    .send(body);
const list = (actor, qs = "", claims) =>
  request(app)
    .get(`/api/admin/users${qs}`)
    .set(bearer(tokenFor(actor, claims)));

/** Two cities in one state plus one elsewhere, and the usual cast. */
async function cast() {
  const w = await seedWorld();
  const adminA = await seedUser("city_admin", { cityId: w.cityA._id });
  const adminB = await seedUser("city_admin", { cityId: w.cityB._id });
  const modA = await seedUser("moderator", { cityId: w.cityA._id });
  const modB = await seedUser("moderator", { cityId: w.cityB._id });
  const citizen = await seedUser("citizen");
  const root = await seedUser("super_admin");
  return { ...w, adminA, adminB, modA, modB, citizen, root };
}

describe("permission (A11)", () => {
  it("A11 a citizen on every admin route -> 403 FORBIDDEN", async () => {
    const { citizen, modA } = await cast();
    const id = String(modA._id);
    for (const res of [
      await list(citizen),
      await patchRole(citizen, id, { role: "staff", reason: "valid reason" }),
      await patchStatus(citizen, id, { status: "suspended", reason: "valid reason" }),
      await request(app)
        .get("/api/cities")
        .set(bearer(tokenFor(citizen))),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
    expect(await auditCount()).toBe(0);
  });

  it("A11 a moderator, staff and dept_head are refused too", async () => {
    const { cityA, deptA1, modA } = await cast();
    const staff = await seedUser("staff", { cityId: cityA._id, departmentId: deptA1._id });
    const head = await seedUser("dept_head", { cityId: cityA._id, departmentId: deptA1._id });
    for (const user of [modA, staff, head]) {
      expect((await list(user)).status).toBe(403);
    }
  });

  it("A11 no token -> 401 on the admin routes", async () => {
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
    expect(
      (await request(app).patch("/api/admin/users/64b000000000000000000001/role")).status,
    ).toBe(401);
  });

  it("a permission failure is answered before the body is validated (no shape leak)", async () => {
    const { citizen, modA } = await cast();
    const res = await patchRole(citizen, String(modA._id), { nonsense: true });
    expect(res.status).toBe(403);
  });

  it("admin responses are never cached", async () => {
    const { adminA } = await cast();
    expect((await list(adminA)).headers["cache-control"]).toBe("no-store");
  });

  it("a suspended admin is blocked on the very next call (403 SUSPENDED)", async () => {
    const { adminA, root } = await cast();
    await rawUpdate(adminA, {
      status: "suspended",
      suspendedReason: "under review",
      suspendedAt: new Date(),
      suspendedBy: root._id,
    });
    const res = await list(adminA);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SUSPENDED");
  });
});

describe("scope hides existence (A12)", () => {
  it("A12 city_admin of A patching role of a user in city B -> 404, byte-identical to a missing id", async () => {
    const { adminA, modB } = await cast();
    const outOfScope = await patchRole(adminA, String(modB._id), {
      role: "moderator",
      reason: "valid reason",
    });
    const missing = await patchRole(adminA, String(new mongoose.Types.ObjectId()), {
      role: "moderator",
      reason: "valid reason",
    });
    expect(outOfScope.status).toBe(404);
    expect(outOfScope.body.error.code).toBe("NOT_FOUND");
    expect(outOfScope.text).toBe(missing.text);
    expect(outOfScope.status).toBe(missing.status);
    expect(await auditCount()).toBe(0);
    expect(mgmtRequest).not.toHaveBeenCalled();
  });

  it("A12 same for the status route, byte for byte", async () => {
    const { adminA, modB } = await cast();
    const input = { status: "suspended", reason: "valid reason" };
    const outOfScope = await patchStatus(adminA, String(modB._id), input);
    const missing = await patchStatus(adminA, String(new mongoose.Types.ObjectId()), input);
    expect(outOfScope.status).toBe(404);
    expect(outOfScope.text).toBe(missing.text);
    expect((await row(modB)).status).toBe("active");
    expect(await auditCount()).toBe(0);
  });

  it("A12 a city_admin cannot suspend a citizen (citizens are out of scope for status changes)", async () => {
    const { adminA, citizen } = await cast();
    const res = await patchStatus(adminA, String(citizen._id), {
      status: "suspended",
      reason: "valid reason",
    });
    expect(res.status).toBe(404);
    expect((await row(citizen)).status).toBe("active");
  });

  it("A12 the same user is reachable by a super_admin (the 404 is about scope, not existence)", async () => {
    const { root, modB } = await cast();
    const res = await patchStatus(root, String(modB._id), {
      status: "suspended",
      reason: "valid reason",
    });
    expect(res.status).toBe(200);
  });

  it("a malformed :id -> 400 VALIDATION_ERROR (never reaches the database)", async () => {
    const { adminA } = await cast();
    const res = await patchRole(adminA, "not-an-id", { role: "moderator", reason: "valid reason" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("the actor's own city and department lists also hide other cities' departments", async () => {
    const { adminA, deptB1 } = await cast();
    const res = await request(app)
      .get(`/api/departments?cityId=${deptB1.cityId}`)
      .set(bearer(tokenFor(adminA)));
    expect(res.status).toBe(403);
  });
});

describe("role change: rules (A13, A20)", () => {
  it("A13 city_admin grants city_admin -> 403 FORBIDDEN; DB unchanged, 0 AuditLog, Auth0 not called", async () => {
    const { adminA, modA, cityA } = await cast();
    const res = await patchRole(adminA, String(modA._id), {
      role: "city_admin",
      cityId: String(cityA._id),
      reason: "valid reason",
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(await roleOf(modA)).toBe("moderator");
    expect(await auditCount()).toBe(0);
    expect(mgmtRequest).not.toHaveBeenCalled();
  });

  // Each row: who acts, on whom, with what body. All must fail and leave no trace.
  const REJECTED = [
    {
      name: "self",
      status: 403,
      go: (c) => [c.adminA, c.adminA, { role: "moderator", cityId: String(c.cityA._id) }],
    },
    {
      name: "equal-level target (another city_admin in the same city)",
      status: 403,
      go: async (c) => [
        c.adminA,
        await seedUser("city_admin", { cityId: c.cityA._id }),
        { role: "moderator", cityId: String(c.cityA._id) },
      ],
    },
    {
      name: "target above the actor (super_admin target, by a city_admin)",
      status: 404, // not in a city_admin's scope, so existence is hidden
      go: (c) => [c.adminA, c.root, { role: "moderator", cityId: String(c.cityA._id) }],
    },
    {
      name: "super_admin acting on another super_admin",
      status: 403,
      go: async (c) => [
        c.root,
        await seedUser("super_admin"),
        { role: "moderator", cityId: String(c.cityA._id) },
      ],
    },
    {
      name: "role equal to the actor's (city_admin makes a city_admin)",
      status: 403,
      go: (c) => [c.adminA, c.modA, { role: "city_admin", cityId: String(c.cityA._id) }],
    },
    {
      name: "role above the actor (city_admin makes a state_officer)",
      status: 403,
      go: (c) => [c.adminA, c.modA, { role: "state_officer", stateCode: "PB" }],
    },
    {
      name: "super_admin created through the API, even by a super_admin",
      status: 403,
      go: (c) => [c.root, c.modA, { role: "super_admin" }],
    },
    {
      name: "city_admin sets a city that is not theirs",
      status: 403,
      go: (c) => [
        c.adminA,
        c.modA,
        { role: "staff", cityId: String(c.cityB._id), departmentId: String(c.deptB1._id) },
      ],
    },
    {
      name: "city_admin names a department of another city",
      status: 403,
      go: (c) => [
        c.adminA,
        c.modA,
        { role: "staff", cityId: String(c.cityA._id), departmentId: String(c.deptB1._id) },
      ],
    },
    {
      name: "staff without a department",
      status: 400,
      go: (c) => [c.adminA, c.citizen, { role: "staff", cityId: String(c.cityA._id) }],
    },
    {
      name: "moderator without a city (super_admin acting, nothing to inherit)",
      status: 400,
      go: (c) => [c.root, c.citizen, { role: "moderator" }],
    },
    {
      name: "staff with a stateCode",
      status: 400,
      go: (c) => [
        c.root,
        c.citizen,
        {
          role: "staff",
          cityId: String(c.cityA._id),
          departmentId: String(c.deptA1._id),
          stateCode: "PB",
        },
      ],
    },
    {
      name: "moderator with a departmentId",
      status: 400,
      go: (c) => [
        c.root,
        c.citizen,
        { role: "moderator", cityId: String(c.cityA._id), departmentId: String(c.deptA1._id) },
      ],
    },
    {
      name: "state_officer without a stateCode",
      status: 400,
      go: (c) => [c.root, c.citizen, { role: "state_officer" }],
    },
    {
      name: "unknown role",
      status: 400,
      go: (c) => [c.root, c.citizen, { role: "emperor" }],
    },
    {
      name: "reason too short",
      status: 400,
      go: (c) => [
        c.adminA,
        c.citizen,
        { role: "moderator", cityId: String(c.cityA._id), reason: "no" },
      ],
    },
    {
      name: "extra body field",
      status: 400,
      go: (c) => [
        c.adminA,
        c.citizen,
        { role: "moderator", cityId: String(c.cityA._id), email: "x@y.z" },
      ],
    },
  ];

  it.each(REJECTED)(
    "A20 $name -> $status, DB and AuditLog unchanged, Auth0 not called",
    async (rule) => {
      const c = await cast();
      const [actor, target, body] = await rule.go(c);
      const before = await row(target);
      const res = await patchRole(actor, String(target._id), { reason: "a valid reason", ...body });
      expect(res.status).toBe(rule.status);
      expect(await row(target)).toEqual(before);
      expect(await auditCount()).toBe(0);
      expect(mgmtRequest).not.toHaveBeenCalled();
    },
  );

  it("A20 role rules apply on the status route too: self, equal level, above", async () => {
    const c = await cast();
    const sameLevel = await seedUser("city_admin", { cityId: c.cityA._id });
    const input = { status: "suspended", reason: "a valid reason" };
    expect((await patchStatus(c.adminA, String(c.adminA._id), input)).status).toBe(403);
    expect((await patchStatus(c.adminA, String(sameLevel._id), input)).status).toBe(403);
    expect((await patchStatus(c.root, String(c.root._id), input)).status).toBe(403);
    expect(await auditCount()).toBe(0);
  });
});

describe("role change: happy path and audit (A14, A15, A16, A35)", () => {
  it("A14 city_admin promotes a citizen to moderator: 200, one complete AuditLog row", async () => {
    const { adminA, citizen, cityA } = await cast();
    const res = await patchRole(adminA, String(citizen._id), {
      role: "moderator",
      cityId: String(cityA._id),
      reason: "volunteered for the ward",
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: String(citizen._id),
      role: "moderator",
      cityId: String(cityA._id),
    });
    expect(JSON.stringify(res.body)).not.toContain(citizen.auth0Id);
    const stored = await row(citizen);
    expect(stored).toMatchObject({ role: "moderator", cityId: cityA._id });

    const logs = await auditRows();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorType: "user",
      actorId: adminA._id,
      actorRole: "city_admin",
      action: "user.role_change",
      targetType: "user",
      targetId: citizen._id,
      reason: "volunteered for the ward",
    });
    expect(logs[0].before).toMatchObject({ role: "citizen" });
    expect(logs[0].after).toMatchObject({ role: "moderator", cityId: String(cityA._id) });
    expect(logs[0].requestId).toBe(res.headers["x-request-id"]);
    expect(typeof logs[0].ip).toBe("string");
    expect(logs[0].ip.length).toBeGreaterThan(0);
    // Nothing personal or secret in the snapshots.
    expect(JSON.stringify([logs[0].before, logs[0].after])).not.toMatch(/@|auth0/);
    expect(logs[0].at).toBeInstanceOf(Date);
  });

  it("A14 promoting a citizen to staff sets city and department", async () => {
    const { adminA, citizen, cityA, deptA1 } = await cast();
    const res = await patchRole(adminA, String(citizen._id), {
      role: "staff",
      cityId: String(cityA._id),
      departmentId: String(deptA1._id),
      reason: "joins the roads team",
    });
    expect(res.status).toBe(200);
    expect(await row(citizen)).toMatchObject({
      role: "staff",
      cityId: cityA._id,
      departmentId: deptA1._id,
    });
  });

  it("A14 demotion removes the scope the new role forbids (no leftovers)", async () => {
    const { cityA, deptA1, adminA } = await cast();
    const staff = await seedUser("staff", { cityId: cityA._id, departmentId: deptA1._id });
    const res = await patchRole(adminA, String(staff._id), {
      role: "moderator",
      reason: "moved to moderation",
    });
    expect(res.status).toBe(200);
    const stored = await row(staff);
    expect(stored.role).toBe("moderator");
    expect(stored.cityId).toEqual(cityA._id);
    expect(stored.departmentId ?? null).toBeNull();
  });

  it("A14 an unchanged role: 200, no write, no audit row", async () => {
    const { adminA, modA, cityA } = await cast();
    const before = await row(modA);
    const res = await patchRole(adminA, String(modA._id), {
      role: "moderator",
      cityId: String(cityA._id),
      reason: "retrying a request",
    });
    expect(res.status).toBe(200);
    expect(await row(modA)).toEqual(before);
    expect(await auditCount()).toBe(0);
  });

  it("A15 promoting to level >= 4 sets the Auth0 flag once, for exactly that user, BEFORE the database changes", async () => {
    const { adminA, modA, cityA, deptA1 } = await cast();
    let roleWhenFlagSet;
    mgmtRequest.mockImplementationOnce(async () => {
      roleWhenFlagSet = await roleOf(modA);
      return {};
    });
    const res = await patchRole(adminA, String(modA._id), {
      role: "dept_head",
      cityId: String(cityA._id),
      departmentId: String(deptA1._id),
      reason: "runs the roads department",
    });
    expect(res.status).toBe(200);
    expect(mfaCalls()).toEqual([{ auth0Id: modA.auth0Id, flag: true }]);
    expect(roleWhenFlagSet).toBe("moderator");
    expect(await roleOf(modA)).toBe("dept_head");
  });

  it("A15 promoting below level 4 does not touch Auth0", async () => {
    const { adminA, citizen, cityA } = await cast();
    await patchRole(adminA, String(citizen._id), {
      role: "moderator",
      cityId: String(cityA._id),
      reason: "valid reason",
    });
    expect(mfaCalls()).toEqual([]);
  });

  it("A15 demoting from level >= 4 commits first, then clears the flag", async () => {
    const { root, cityA, deptA1 } = await cast();
    const head = await seedUser("dept_head", { cityId: cityA._id, departmentId: deptA1._id });
    let roleWhenCleared;
    mgmtRequest.mockImplementationOnce(async () => {
      roleWhenCleared = await roleOf(head);
      return {};
    });
    const res = await patchRole(root, String(head._id), { role: "staff", reason: "stepping down" });
    expect(res.status).toBe(200);
    expect(mfaCalls()).toEqual([{ auth0Id: head.auth0Id, flag: false }]);
    expect(roleWhenCleared).toBe("staff");
  });

  it("A15 a demotion whose flag-clear fails still succeeds (best effort) and leaves a note", async () => {
    const { root, cityA, deptA1 } = await cast();
    const head = await seedUser("dept_head", { cityId: cityA._id, departmentId: deptA1._id });
    await failNext("upstream", 2); // the call and its one retry
    const res = await patchRole(root, String(head._id), { role: "staff", reason: "stepping down" });
    expect(res.status).toBe(200);
    expect(await roleOf(head)).toBe("staff");
    const actions = (await auditRows()).map((r) => r.action);
    expect(actions).toEqual(["user.role_change", "user.mfa_flag_sync_failed"]);
  });

  it("A16 Auth0 rejects during a promotion -> 503 AUTH_PROVIDER_UNAVAILABLE, role unchanged, 0 AuditLog", async () => {
    const { adminA, modA, cityA, deptA1 } = await cast();
    await failNext("timeout");
    const before = await row(modA);
    const res = await patchRole(adminA, String(modA._id), {
      role: "dept_head",
      cityId: String(cityA._id),
      departmentId: String(deptA1._id),
      reason: "runs the roads department",
    });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AUTH_PROVIDER_UNAVAILABLE");
    expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules/);
    expect(await row(modA)).toEqual(before);
    expect(await auditCount()).toBe(0);
  });

  it("A16 an unexpected (untyped) Auth0 error also gives 503 and writes nothing", async () => {
    const { adminA, modA, cityA, deptA1 } = await cast();
    mgmtRequest.mockRejectedValueOnce(
      new Error("socket hang up: https://tenant/?client_secret=hunter2"),
    );
    const res = await patchRole(adminA, String(modA._id), {
      role: "dept_head",
      cityId: String(cityA._id),
      departmentId: String(deptA1._id),
      reason: "runs the roads department",
    });
    expect(res.status).toBe(503);
    expect(res.text).not.toContain("hunter2");
    expect(await roleOf(modA)).toBe("moderator");
    expect(await auditCount()).toBe(0);
  });

  it("A16 retrying after the outage completes the promotion exactly once", async () => {
    const { adminA, modA, cityA, deptA1 } = await cast();
    const body = {
      role: "dept_head",
      cityId: String(cityA._id),
      departmentId: String(deptA1._id),
      reason: "runs the roads department",
    };
    await failNext("network");
    expect((await patchRole(adminA, String(modA._id), body)).status).toBe(503);
    expect((await patchRole(adminA, String(modA._id), body)).status).toBe(200);
    expect(await auditCount()).toBe(1);
  });

  it("A35 promoting needs the actor's MFA claim: without it 403 MFA_REQUIRED and nothing happens", async () => {
    const { adminA, modA, cityA } = await cast();
    const input = {
      role: "staff",
      cityId: String(cityA._id),
      departmentId: undefined,
      reason: "valid reason",
    };
    const res = await patchRole(adminA, String(modA._id), input, { mfa: undefined });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("MFA_REQUIRED");
    expect(await roleOf(modA)).toBe("moderator");
    expect(await auditCount()).toBe(0);
    expect(mgmtRequest).not.toHaveBeenCalled();
  });

  it("super_admin can make a state_officer (with a stateCode) and a city_admin", async () => {
    const { root, citizen, modA, cityA } = await cast();
    const so = await patchRole(root, String(citizen._id), {
      role: "state_officer",
      stateCode: "PB",
      reason: "state oversight",
    });
    expect(so.status).toBe(200);
    expect(await row(citizen)).toMatchObject({ role: "state_officer", stateCode: "PB" });
    const ca = await patchRole(root, String(modA._id), {
      role: "city_admin",
      cityId: String(cityA._id),
      reason: "new city lead",
    });
    expect(ca.status).toBe(200);
    expect(mfaCalls().map((c) => c.flag)).toEqual([true, true]);
  });

  it("super_admin: an unknown city is a 400, not a 404", async () => {
    const { root, citizen } = await cast();
    const res = await patchRole(root, String(citizen._id), {
      role: "moderator",
      cityId: String(new mongoose.Types.ObjectId()),
      reason: "valid reason",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("two admins changing one user at once: one wins, the other gets 409 CONFLICT or both are consistent", async () => {
    const { root, adminA, citizen, cityA } = await cast();
    const [a, b] = await Promise.all([
      patchRole(root, String(citizen._id), {
        role: "moderator",
        cityId: String(cityA._id),
        reason: "first change",
      }),
      patchRole(adminA, String(citizen._id), {
        role: "moderator",
        cityId: String(cityA._id),
        reason: "second change",
      }),
    ]);
    expect([a.status, b.status].filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
    for (const s of [a.status, b.status]) expect([200, 409]).toContain(s);
    expect(await roleOf(citizen)).toBe("moderator");
    expect(await auditCount()).toBeLessThanOrEqual(2);
  });
});

describe("suspend and reactivate (A17, A18, A19)", () => {
  it("A17 suspending an in-scope user: 200, status and reason stored, one AuditLog", async () => {
    const { adminA, modA } = await cast();
    const res = await patchStatus(adminA, String(modA._id), {
      status: "suspended",
      reason: "abusive comments",
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      status: "suspended",
      suspendedReason: "abusive comments",
    });
    expect(await row(modA)).toMatchObject({
      status: "suspended",
      suspendedReason: "abusive comments",
      suspendedBy: adminA._id,
    });
    expect((await row(modA)).suspendedAt).toBeInstanceOf(Date);
    const logs = await auditRows();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: adminA._id,
      actorRole: "city_admin",
      action: "user.suspend",
      targetId: modA._id,
      reason: "abusive comments",
    });
    expect(logs[0].before).toMatchObject({ status: "active" });
    expect(logs[0].after).toMatchObject({ status: "suspended" });
    expect(mgmtRequest).not.toHaveBeenCalled(); // no Auth0 call is needed for the block to work
  });

  it("A17 a missing reason -> 400, nothing changes", async () => {
    const { adminA, modA } = await cast();
    const res = await patchStatus(adminA, String(modA._id), { status: "suspended" });
    expect(res.status).toBe(400);
    expect((await row(modA)).status).toBe("active");
    expect(await auditCount()).toBe(0);
  });

  it("A18 the suspended user's old, still valid token -> 403 SUSPENDED on the next call", async () => {
    const { adminA, modA } = await cast();
    const token = tokenFor(modA);
    const call = () => request(app).get("/api/me").set(bearer(token));
    expect((await call()).status).toBe(200);
    expect(
      (
        await patchStatus(adminA, String(modA._id), {
          status: "suspended",
          reason: "abusive comments",
        })
      ).status,
    ).toBe(200);
    const blocked = await call();
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("SUSPENDED");
    expect(blocked.body.error.details).toEqual({ reason: "abusive comments" });
    // Every other route is blocked as well.
    const resend = await request(app).post("/api/me/resend-verification").set(bearer(token));
    expect(resend.body.error.code).toBe("SUSPENDED");
  });

  it("A19 reactivating: 200, reason cleared, AuditLog row, and the next call works", async () => {
    const { adminA, modA } = await cast();
    await patchStatus(adminA, String(modA._id), {
      status: "suspended",
      reason: "abusive comments",
    });
    const res = await patchStatus(adminA, String(modA._id), {
      status: "active",
      reason: "appeal accepted",
    });
    expect(res.status).toBe(200);
    const stored = await row(modA);
    expect(stored.status).toBe("active");
    expect(stored.suspendedReason ?? null).toBeNull();
    expect(stored.suspendedAt ?? null).toBeNull();
    expect(stored.suspendedBy ?? null).toBeNull();
    const logs = await auditRows();
    expect(logs.map((l) => l.action)).toEqual(["user.suspend", "user.reactivate"]);
    expect(logs[1].reason).toBe("appeal accepted");
    expect(
      (
        await request(app)
          .get("/api/me")
          .set(bearer(tokenFor(modA)))
      ).status,
    ).toBe(200);
  });

  it("same status again: 200 no-op, no audit row", async () => {
    const { adminA, modA } = await cast();
    const res = await patchStatus(adminA, String(modA._id), {
      status: "active",
      reason: "already active",
    });
    expect(res.status).toBe(200);
    await patchStatus(adminA, String(modA._id), {
      status: "suspended",
      reason: "abusive comments",
    });
    await patchStatus(adminA, String(modA._id), {
      status: "suspended",
      reason: "abusive comments",
    });
    expect(await auditCount()).toBe(1);
  });

  it("A19 a role change on a suspended user is allowed and keeps them suspended", async () => {
    const { adminA, modA, cityA, deptA1 } = await cast();
    await patchStatus(adminA, String(modA._id), {
      status: "suspended",
      reason: "abusive comments",
    });
    const res = await patchRole(adminA, String(modA._id), {
      role: "staff",
      cityId: String(cityA._id),
      departmentId: String(deptA1._id),
      reason: "valid reason",
    });
    expect(res.status).toBe(200);
    expect(await row(modA)).toMatchObject({
      role: "staff",
      status: "suspended",
      suspendedReason: "abusive comments",
    });
  });
});

describe("audit exactness (A22) and append-only (A23)", () => {
  it("A22 one row per success, none per rejection", async () => {
    const { adminA, adminB, modA, modB, citizen, cityA, root } = await cast();
    // Admin writes are limited to 10 a minute per user, so the successes use a second admin.
    const adminA2 = await seedUser("city_admin", { cityId: cityA._id });
    const id = (u) => String(u._id);
    let expected = 0;
    const expectCount = async (label) => expect(await auditCount(), label).toBe(expected);

    // Rejections first: every kind of failure.
    await patchRole(adminA, id(modB), { role: "moderator", reason: "valid reason" }); // 404
    await patchRole(adminA, id(modA), {
      role: "city_admin",
      cityId: String(cityA._id),
      reason: "valid reason",
    }); // 403
    await patchRole(adminA, id(adminB), {
      role: "moderator",
      cityId: String(cityA._id),
      reason: "valid reason",
    }); // 404/403
    await patchRole(adminA, id(modA), {
      role: "moderator",
      cityId: String(cityA._id),
      reason: "no",
    }); // 400
    await patchRole(adminA, id(root), {
      role: "moderator",
      cityId: String(cityA._id),
      reason: "valid reason",
    }); // 404
    await patchStatus(adminA, id(adminA), { status: "suspended", reason: "valid reason" }); // 403 self
    await patchStatus(adminA, id(citizen), { status: "suspended", reason: "valid reason" }); // 404
    await patchStatus(adminA, id(modB), { status: "suspended", reason: "valid reason" }); // 404
    await expectCount("after rejections");

    // Successes: +1 each.
    expect(
      (
        await patchRole(adminA2, id(citizen), {
          role: "moderator",
          cityId: String(cityA._id),
          reason: "valid reason",
        })
      ).status,
    ).toBe(200);
    expected += 1;
    await expectCount("role change");
    expect(
      (await patchStatus(adminA2, id(modA), { status: "suspended", reason: "valid reason" }))
        .status,
    ).toBe(200);
    expected += 1;
    await expectCount("suspend");
    expect(
      (await patchStatus(adminA2, id(modA), { status: "active", reason: "valid reason" })).status,
    ).toBe(200);
    expected += 1;
    await expectCount("reactivate");
    // No-ops: +0.
    await patchStatus(adminA2, id(modA), { status: "active", reason: "valid reason" });
    await patchRole(adminA2, id(citizen), {
      role: "moderator",
      cityId: String(cityA._id),
      reason: "valid reason",
    });
    await expectCount("no-ops");
  });

  it("A22 a rejected promotion (Auth0 down) leaves no audit row and no write", async () => {
    const { adminA, modA, cityA, deptA1 } = await cast();
    await failNext("network");
    await patchRole(adminA, String(modA._id), {
      role: "dept_head",
      cityId: String(cityA._id),
      departmentId: String(deptA1._id),
      reason: "valid reason",
    });
    expect(await auditCount()).toBe(0);
    expect(await roleOf(modA)).toBe("moderator");
  });

  it("A23 existing rows cannot be changed or removed through the model, and stay intact", async () => {
    const { adminA, modA } = await cast();
    await patchStatus(adminA, String(modA._id), {
      status: "suspended",
      reason: "abusive comments",
    });
    const [original] = await auditRows();
    const attempts = [
      () => AuditLog.updateOne({ _id: original._id }, { $set: { reason: "edited" } }),
      () => AuditLog.updateMany({}, { $set: { reason: "edited" } }),
      () => AuditLog.findOneAndUpdate({ _id: original._id }, { $set: { reason: "edited" } }),
      () =>
        AuditLog.findOneAndReplace(
          { _id: original._id },
          {
            actorType: "system",
            actorLabel: "x",
            action: "user.suspend",
            targetId: original.targetId,
            reason: "x y z",
          },
        ),
      () => AuditLog.replaceOne({ _id: original._id }, { actorType: "system" }),
      () => AuditLog.deleteOne({ _id: original._id }),
      () => AuditLog.deleteMany({}),
      () => AuditLog.findOneAndDelete({ _id: original._id }),
      () => AuditLog.bulkWrite([{ deleteOne: { filter: { _id: original._id } } }]),
      async () => {
        const doc = await AuditLog.findById(original._id);
        doc.reason = "edited";
        return doc.save();
      },
      async () => (await AuditLog.findById(original._id)).deleteOne(),
    ];
    for (const attempt of attempts) await expect((async () => attempt())()).rejects.toThrow();
    expect(await auditRows()).toEqual([original]);
  });

  it("A23 the audit trail has no HTTP route to change it", async () => {
    const { root } = await cast();
    for (const method of ["post", "put", "patch", "delete"]) {
      const res = await request(app)
        [method]("/api/admin/audit")
        .set(bearer(tokenFor(root)))
        .send({});
      expect([404, 405]).toContain(res.status);
    }
  });
});

describe("list: scope, shape, pagination, search (A30, A31, A32)", () => {
  it("A30 city_admin sees only their city (plus nobody else's), super_admin sees all, moderator is refused", async () => {
    const c = await cast();
    const mine = await list(c.adminA);
    expect(mine.status).toBe(200);
    const ids = mine.body.items.map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining([String(c.adminA._id), String(c.modA._id)]));
    expect(ids).not.toContain(String(c.modB._id));
    expect(ids).not.toContain(String(c.adminB._id));
    expect(ids).not.toContain(String(c.root._id));
    expect(ids).not.toContain(String(c.citizen._id)); // citizens carry no city: found by exact email only
    expect(mine.body.nextCursor).toBeNull();

    const all = await list(c.root);
    expect(all.body.items.map((u) => u.id)).toEqual(
      expect.arrayContaining(
        [c.adminA, c.adminB, c.modA, c.modB, c.citizen, c.root].map((u) => String(u._id)),
      ),
    );
    expect((await list(c.modA)).status).toBe(403);
  });

  it("A30 no response ever contains an auth0Id, and every item has the approved fields", async () => {
    const c = await cast();
    const res = await list(c.root);
    expect(res.text).not.toMatch(/auth0\|/);
    for (const item of res.body.items) {
      expect(Object.keys(item).sort()).toEqual(
        expect.arrayContaining(
          [
            "id",
            "email",
            "name",
            "avatarUrl",
            "role",
            "level",
            "cityId",
            "departmentId",
            "stateCode",
            "status",
            "suspendedReason",
            "emailVerified",
            "lastLoginAt",
            "createdAt",
            "canManage",
          ].sort(),
        ),
      );
      expect(item).not.toHaveProperty("auth0Id");
      expect(item).not.toHaveProperty("_id");
    }
  });

  it("A30 canManage is computed by the server: not for self, not for equal or higher levels", async () => {
    const c = await cast();
    const items = Object.fromEntries((await list(c.adminA)).body.items.map((u) => [u.id, u]));
    expect(items[String(c.modA._id)].canManage).toBe(true);
    expect(items[String(c.adminA._id)].canManage).toBe(false);
  });

  it("A30 a state_officer sees users of the cities in their state, read-only", async () => {
    const c = await cast();
    const officer = await seedUser("state_officer", { stateCode: "PB" });
    const pune = await seedUser("moderator", { cityId: c.cityC._id }); // Maharashtra
    const res = await list(officer);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining([String(c.modA._id), String(c.modB._id)]));
    expect(ids).not.toContain(String(pune._id));
    // read-only: no promotion, no suspension
    const write = await patchRole(officer, String(c.modA._id), {
      role: "staff",
      reason: "valid reason",
    });
    expect(write.status).toBe(403);
    expect(res.body.items.every((u) => u.canManage === false)).toBe(true);
  });

  it("A30 a city_admin finds a citizen only by the exact full email", async () => {
    const c = await cast();
    const byEmail = await list(c.adminA, `?q=${encodeURIComponent(c.citizen.email)}`);
    expect(byEmail.body.items.map((u) => u.id)).toEqual([String(c.citizen._id)]);
    const byPrefix = await list(c.adminA, `?q=${c.citizen.email.slice(0, 5)}`);
    expect(byPrefix.body.items.map((u) => u.id)).not.toContain(String(c.citizen._id));
  });

  it("A30 filters: role, status", async () => {
    const c = await cast();
    await patchStatus(c.adminA, String(c.modA._id), {
      status: "suspended",
      reason: "abusive comments",
    });
    const onlyMods = await list(c.adminA, "?role=moderator");
    expect(onlyMods.body.items.map((u) => u.role)).toEqual(["moderator"]);
    const suspended = await list(c.adminA, "?status=suspended");
    expect(suspended.body.items.map((u) => u.id)).toEqual([String(c.modA._id)]);
  });

  it.each([
    ["an unknown parameter", "?foo=1"],
    ["a role that does not exist", "?role=emperor"],
    ["a role operator object", "?role[$ne]=citizen"],
    ["a status operator object", "?status[$ne]=active"],
    ["a q operator object", "?q[$ne]=x"],
    ["q shorter than 3", "?q=ab"],
    ["q longer than 64", `?q=${"a".repeat(65)}`],
    ["a bad cursor", "?cursor=not-a-cursor"],
    [
      "a cursor with garbage inside",
      `?cursor=${Buffer.from('{"createdAt":{"$gt":0}}').toString("base64url")}`,
    ],
    ["limit 0", "?limit=0"],
    ["limit not a number", "?limit=abc"],
  ])("A30 %s -> 400 VALIDATION_ERROR", async (_n, qs) => {
    const { adminA } = await cast();
    const res = await list(adminA, qs);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("A31 55 rows, cursor pages: no gaps, no duplicates, no page over 50", async () => {
    const { cityA, adminA } = await cast();
    const sameInstant = new Date("2026-01-01T00:00:00.000Z");
    // Many rows share one createdAt on purpose: the cursor must break ties by _id.
    for (let i = 0; i < 55; i++) {
      await seedUser(
        "moderator",
        { cityId: cityA._id },
        { createdAt: i < 30 ? sameInstant : new Date(sameInstant.getTime() + i * 1000) },
      );
    }
    const expected = await User.collection.countDocuments({ cityId: cityA._id });
    expect(expected).toBeGreaterThan(55); // the 55, the admin and the moderator from cast()

    const seen = [];
    let cursor;
    let pages = 0;
    do {
      const res = await list(
        adminA,
        `?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(20);
      seen.push(...res.body.items.map((u) => u.id));
      cursor = res.body.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(expected);
  });

  it("A31 limit=500 never returns more than 50 rows", async () => {
    const { cityA, adminA } = await cast();
    for (let i = 0; i < 55; i++) await seedUser("moderator", { cityId: cityA._id });
    const res = await list(adminA, "?limit=500");
    if (res.status === 200) {
      expect(res.body.items.length).toBeLessThanOrEqual(50);
      expect(res.body.nextCursor).not.toBeNull();
    } else {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    const dflt = await list(adminA);
    expect(dflt.body.items.length).toBeLessThanOrEqual(20);
  });

  it("A31 the default order is newest first", async () => {
    const { cityA, adminA } = await cast();
    const older = await seedUser(
      "moderator",
      { cityId: cityA._id },
      { createdAt: new Date("2020-01-01") },
    );
    const newer = await seedUser(
      "moderator",
      { cityId: cityA._id },
      { createdAt: new Date("2030-01-01") },
    );
    const ids = (await list(adminA)).body.items.map((u) => u.id);
    expect(ids.indexOf(String(newer._id))).toBeLessThan(ids.indexOf(String(older._id)));
  });

  it("A32 search text is literal: regex characters match nothing special and never a 500", async () => {
    const { cityA, adminA } = await cast();
    const odd = await seedUser("moderator", { cityId: cityA._id }, { name: "a(b literal" });
    await seedUser("moderator", { cityId: cityA._id }, { name: "plain person" });
    for (const q of [".*.", "a(b", "$ne", "[a-z]+", "^.*$", "(?:x+)+$"]) {
      const res = await list(adminA, `?q=${encodeURIComponent(q)}`);
      expect(res.status, q).toBe(200);
      const names = res.body.items.map((u) => u.name);
      if (q === "a(b") expect(names).toEqual([odd.name]);
      else expect(names, q).toEqual([]);
    }
  });

  it("A32 search is a case-insensitive name prefix and a lowercase email prefix", async () => {
    const { cityA, adminA } = await cast();
    const ashu = await seedUser(
      "moderator",
      { cityId: cityA._id },
      { name: "Ashu Kumar", email: "ashu.k@example.com" },
    );
    const byName = await list(adminA, "?q=ASH");
    expect(byName.body.items.map((u) => u.id)).toContain(String(ashu._id));
    const byEmail = await list(adminA, "?q=ashu.k");
    expect(byEmail.body.items.map((u) => u.id)).toContain(String(ashu._id));
    const exact = await list(adminA, "?q=ashu.k@example.com"); // an @ means: exact full email
    expect(exact.body.items.map((u) => u.id)).toEqual([String(ashu._id)]);
    const inside = await list(adminA, "?q=kumar"); // not a prefix of the name
    expect(inside.body.items.map((u) => u.id)).not.toContain(String(ashu._id));
  });
});

describe("geo pickers", () => {
  it("a city_admin sees only their own city; a super_admin sees all", async () => {
    const c = await cast();
    const mine = await request(app)
      .get("/api/cities")
      .set(bearer(tokenFor(c.adminA)));
    expect(mine.status).toBe(200);
    expect(mine.body.items.map((x) => x.id)).toEqual([String(c.cityA._id)]);
    const all = await request(app)
      .get("/api/cities")
      .set(bearer(tokenFor(c.root)));
    expect(all.body.items).toHaveLength(3);
    const deps = await request(app)
      .get(`/api/departments?cityId=${c.cityA._id}`)
      .set(bearer(tokenFor(c.adminA)));
    expect(deps.status).toBe(200);
    expect(deps.body.items.map((d) => d.code).sort()).toEqual(["ROADS", "WATER"]);
    const bad = await request(app)
      .get("/api/departments?cityId=nope")
      .set(bearer(tokenFor(c.adminA)));
    expect(bad.status).toBe(400);
  });
});

describe("rate limit on admin writes", () => {
  it("the 11th write in a minute -> 429 RATE_LIMITED, per user", async () => {
    const { adminA, adminB, modA } = await cast();
    const noop = () =>
      patchStatus(adminA, String(modA._id), { status: "active", reason: "valid reason" });
    for (let i = 0; i < 10; i++) expect((await noop()).status).toBe(200);
    const limited = await noop();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect((await list(adminB)).status).toBe(200); // another admin is unaffected
  });
});

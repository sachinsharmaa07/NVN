// /api/me: profile read and update.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, seedUser, tokenFor, bearer } from "../helpers/testDb.js";
import { resetMgmt } from "../helpers/mgmtMock.js";
import { User } from "../../src/models/User.js";

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

const dbRow = (user) => User.collection.findOne({ _id: user._id });
const patchMe = (token, body) => request(app).patch("/api/me").set(bearer(token)).send(body);

describe("PATCH /api/me", () => {
  it("A25 changes only name, preferredLanguage and defaultPincode", async () => {
    const user = await seedUser("citizen");
    const before = await dbRow(user);
    const res = await patchMe(tokenFor(user), {
      name: "  Asha Rao ",
      preferredLanguage: "hi",
      defaultPincode: "144401",
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: "Asha Rao",
      preferredLanguage: "hi",
      defaultPincode: "144401",
    });
    const after = await dbRow(user);
    const changed = Object.keys(after).filter(
      (k) => k !== "__v" && JSON.stringify(after[k]) !== JSON.stringify(before[k]),
    );
    expect(changed.sort()).toEqual(
      ["defaultPincode", "name", "preferredLanguage", "updatedAt"].sort(),
    );
    expect(after).toMatchObject({ role: "citizen", status: "active", email: user.email });
  });

  it("A25 a single field is enough; a null pincode clears it", async () => {
    const user = await seedUser("citizen", {}, { defaultPincode: "144401" });
    expect((await patchMe(tokenFor(user), { name: "Only Name" })).status).toBe(200);
    expect((await dbRow(user)).defaultPincode).toBe("144401");
    const cleared = await patchMe(tokenFor(user), { defaultPincode: null });
    expect(cleared.status).toBe(200);
    expect((await dbRow(user)).defaultPincode ?? null).toBeNull();
  });

  it.each([
    ["pincode starting with 0", { defaultPincode: "012345" }],
    ["pincode too short", { defaultPincode: "1444" }],
    ["language not en or hi", { preferredLanguage: "fr" }],
    ["name over 100 characters", { name: "x".repeat(101) }],
    ["empty name", { name: "" }],
    ["empty body", {}],
  ])("A25 %s -> 400 VALIDATION_ERROR, row unchanged", async (_n, body) => {
    const user = await seedUser("citizen");
    const before = await dbRow(user);
    const res = await patchMe(tokenFor(user), body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await dbRow(user)).toEqual(before);
  });

  it.each([
    ["role", { role: "super_admin" }],
    ["cityId", { cityId: "64b000000000000000000001" }],
    ["email", { email: "attacker@example.com" }],
    ["status", { status: "active" }],
    ["emailVerified", { emailVerified: true }],
    ["departmentId", { departmentId: "64b000000000000000000001" }],
    ["stateCode", { stateCode: "PB" }],
    ["auth0Id", { auth0Id: "auth0|someone-else" }],
    ["a valid field plus role", { name: "Fine", role: "super_admin" }],
  ])("A24 %s in the body -> 400, DB unchanged", async (_n, body) => {
    const user = await seedUser("citizen");
    const before = await dbRow(user);
    const res = await patchMe(tokenFor(user), body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await dbRow(user)).toEqual(before);
  });

  it("PATCH /api/me without a token -> 401", async () => {
    const res = await request(app).patch("/api/me").send({ name: "x" });
    expect(res.status).toBe(401);
  });

  it("a suspended user cannot edit their profile -> 403 SUSPENDED", async () => {
    const admin = await seedUser("super_admin");
    const user = await seedUser(
      "citizen",
      {},
      {
        status: "suspended",
        suspendedReason: "spam links",
        suspendedAt: new Date(),
        suspendedBy: admin._id,
      },
    );
    const res = await patchMe(tokenFor(user), { name: "New" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SUSPENDED");
    expect((await dbRow(user)).name).toBe(user.name);
  });

  it("only the caller's own row can change (the id comes from the token, not the request)", async () => {
    const me = await seedUser("citizen");
    const other = await seedUser("citizen");
    const res = await patchMe(tokenFor(me), { name: "Mine" });
    expect(res.status).toBe(200);
    expect((await dbRow(other)).name).toBe(other.name);
    expect((await dbRow(me)).name).toBe("Mine");
  });

  it("the response is never cached", async () => {
    const user = await seedUser("citizen");
    const res = await patchMe(tokenFor(user), { name: "Zed" });
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

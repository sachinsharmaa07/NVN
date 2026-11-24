// The request pipeline, end to end: real token check (against a local key server) -> loadUser ->
// guards -> real MongoDB. Only the Auth0 Management API client is replaced (see helpers/mgmtMock.js).
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import http from "node:http";
import express from "express";
import request from "supertest";
import {
  signToken,
  signWithWrongKey,
  startKeyServer,
  NS,
  AUDIENCE,
  ISSUER,
} from "../helpers/fakeAuth0.js";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, seedUser, seedWorld, tokenFor, rawUpdate, bearer } from "../helpers/testDb.js";
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
beforeAll(resetMgmt);
afterEach(() => vi.useRealTimers());

const me = (token) => request(app).get("/api/me").set(bearer(token));
const rowCount = () => User.collection.countDocuments({});

describe("token check (A1 to A5)", () => {
  it("A1 no token -> 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHENTICATED", message: expect.any(String) } });
    expect(await rowCount()).toBe(0);
  });

  it("A1 a header that is not Bearer -> 401", async () => {
    const res = await request(app).get("/api/me").set("Authorization", "Basic abc");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("A2 wrong audience -> 401, no detail text", async () => {
    const res = await me(signToken({ aud: "https://other-api" }));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(JSON.stringify(res.body)).not.toMatch(/audience|issuer|signature|expired|alg/i);
    expect(await rowCount()).toBe(0);
  });

  it("A3 expired (a minute ago, beyond the 5 s tolerance) -> 401", async () => {
    const res = await me(signToken({ exp: Math.floor(Date.now() / 1000) - 60 }));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it.each([
    ["wrong issuer", () => signToken({ iss: "https://evil.example/" })],
    ["signed with another key", () => signWithWrongKey({})],
    ["HS256 instead of RS256", () => signToken({}, { header: { alg: "HS256" } })],
    ['alg "none"', () => signToken({}, { header: { alg: "none" } })],
    ["not a JWT at all", () => "garbage"],
  ])("A4 %s -> 401, and no word about why", async (_name, makeToken) => {
    const res = await me(makeToken());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(JSON.stringify(res.body)).not.toMatch(/audience|issuer|signature|alg/i);
    expect(await rowCount()).toBe(0);
  });

  it("A5 unknown kid -> 401", async () => {
    const res = await me(signToken({ kid: "not-in-the-key-set" }));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("an unknown query parameter -> 400 VALIDATION_ERROR (and nothing is created for it)", async () => {
    const res = await request(app).get("/api/me?role=super_admin").set(bearer(signToken()));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("first request: JIT user (A6, A7)", () => {
  it("A6 creates exactly one citizen row from the claims", async () => {
    const token = signToken({
      sub: "auth0|first",
      email: "Asha@Example.COM",
      name: "Asha Rao",
      picture: "https://lh3.example/a.png",
      email_verified: true,
    });
    const res = await me(token);
    expect(res.status).toBe(200);

    const rows = await User.collection.find({}).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      auth0Ids: ["auth0|first"],
      email: "asha@example.com",
      emailVerified: true,
      name: "Asha Rao",
      avatarUrl: "https://lh3.example/a.png",
      role: "citizen",
      status: "active",
      preferredLanguage: "en",
    });
    expect(rows[0].lastLoginAt).toBeInstanceOf(Date);
    expect(res.body.user).toMatchObject({
      id: String(rows[0]._id),
      email: "asha@example.com",
      role: "citizen",
      level: 1,
      status: "active",
      emailVerified: true,
    });
    expect(res.body.user.permissions).toEqual(expect.arrayContaining(["profile:read_own"]));
    expect(res.body.user.permissions).not.toContain("user:promote");
    expect(JSON.stringify(res.body)).not.toContain("auth0|first"); // auth0Id never leaves the server
  });

  it("A6 a second request finds the same row", async () => {
    const token = signToken({ sub: "auth0|again" });
    const first = await me(token);
    const second = await me(token);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(await rowCount()).toBe(1);
  });

  it("a first request whose token has no email claim -> 401 TOKEN_CLAIMS_MISSING, no row", async () => {
    const res = await me(signToken({ sub: "auth0|noemail", email: null }));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_CLAIMS_MISSING");
    expect(await rowCount()).toBe(0);
  });

  it("an email claim that is not a string counts as missing (no operator reaches the database)", async () => {
    const res = await me(signToken({ sub: "auth0|obj", email: { $ne: null } }));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_CLAIMS_MISSING");
    expect(await rowCount()).toBe(0);
  });

  it("A7 five concurrent first requests with the same token -> five 200s and one row (x20 runs)", async () => {
    for (let run = 0; run < 20; run++) {
      await User.collection.deleteMany({});
      const token = signToken({ sub: `auth0|race-${run}`, email: `race${run}@example.com` });
      const responses = await Promise.all(Array.from({ length: 5 }, () => me(token)));
      expect(
        responses.map((r) => r.status),
        `run ${run}`,
      ).toEqual([200, 200, 200, 200, 200]);
      expect(await rowCount(), `run ${run}`).toBe(1);
      expect(new Set(responses.map((r) => r.body.user.id)).size, `run ${run}`).toBe(1);
    }
  });

  it("A7 the unique index on auth0Ids exists (it is what makes the race safe)", async () => {
    const indexes = await User.collection.indexes();
    const byAuth0Id = indexes.find((i) => i.key.auth0Ids === 1);
    expect(byAuth0Id?.unique).toBe(true);
  });
});

describe("the database decides, not the token (A8, A9, A10, A21)", () => {
  it("A8 a token that claims super_admin is still a citizen, and the row is not elevated", async () => {
    const token = signToken({
      sub: "auth0|sneaky",
      role: "super_admin",
      [`${NS}roles`]: ["super_admin"],
      [`${NS}role`]: "super_admin",
      scope: "user:promote",
      permissions: ["user:promote"],
    });
    const res = await me(token);
    expect(res.body.user.role).toBe("citizen");
    expect(res.body.user.permissions).not.toContain("user:promote");
    const row = await User.collection.findOne({ auth0Ids: "auth0|sneaky" });
    expect(row.role).toBe("citizen");
    const admin = await request(app).get("/api/admin/users").set(bearer(token));
    expect(admin.status).toBe(403);
    expect(admin.body.error.code).toBe("FORBIDDEN");
  });

  it('A8 an existing citizen row with a token claiming role "city_admin" stays a citizen', async () => {
    const citizen = await seedUser("citizen");
    const res = await me(tokenFor(citizen, { role: "city_admin" }));
    expect(res.body.user.role).toBe("citizen");
    expect((await User.collection.findOne({ _id: citizen._id })).role).toBe("citizen");
  });

  it("A9 a verified-only route with email_verified false -> 403 EMAIL_NOT_VERIFIED", async () => {
    const { cityA } = await seedWorld();
    const admin = await seedUser("city_admin", { cityId: cityA._id });
    const res = await request(app)
      .get("/api/admin/users")
      .set(bearer(tokenFor(admin, { email_verified: false })));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it('A9 the string "true" is not a verified email', async () => {
    const { cityA } = await seedWorld();
    const admin = await seedUser("city_admin", { cityId: cityA._id });
    const res = await request(app)
      .get("/api/admin/users")
      .set(bearer(tokenFor(admin, { email_verified: "true" })));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("A9 /api/me works for an unverified user and reports emailVerified false", async () => {
    const res = await me(signToken({ sub: "auth0|unverified", email_verified: false }));
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(false);
  });

  it("A10 a suspended user with a valid token -> 403 SUSPENDED with the reason; lastLoginAt not written", async () => {
    const old = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const user = await seedUser(
      "citizen",
      {},
      {
        status: "suspended",
        suspendedReason: "repeated spam posts",
        suspendedAt: new Date(),
        suspendedBy: (await seedUser("super_admin"))._id,
        lastLoginAt: old,
        emailVerified: false,
      },
    );
    const res = await me(tokenFor(user, { email: "changed@example.com", email_verified: true }));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SUSPENDED");
    expect(res.body.error.details).toEqual({ reason: "repeated spam posts" });
    const row = await User.collection.findOne({ _id: user._id });
    expect(row.lastLoginAt.getTime()).toBe(old.getTime());
    expect(row.email).toBe(user.email); // nothing from the token was written
    expect(row.emailVerified).toBe(false);
  });

  it("A21 roles are read on every request: demoting the actor in the DB blocks the same token at once", async () => {
    const { cityA } = await seedWorld();
    const admin = await seedUser("city_admin", { cityId: cityA._id });
    const token = tokenFor(admin);
    const list = () => request(app).get("/api/admin/users").set(bearer(token));
    expect((await list()).status).toBe(200);
    await rawUpdate(admin, { role: "citizen" }, { cityId: "" });
    const after = await list();
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe("FORBIDDEN");
  });
});

describe("MFA for level 4 and above (A35)", () => {
  it("A35 a city_admin whose token lacks the mfa claim -> 403 MFA_REQUIRED; with the claim -> 200", async () => {
    const { cityA } = await seedWorld();
    const admin = await seedUser("city_admin", { cityId: cityA._id });
    const without = await request(app)
      .get("/api/admin/users")
      .set(bearer(tokenFor(admin, { mfa: undefined })));
    expect(without.status).toBe(403);
    expect(without.body.error.code).toBe("MFA_REQUIRED");
    const falsy = await request(app)
      .get("/api/admin/users")
      .set(bearer(tokenFor(admin, { mfa: "true" })));
    expect(falsy.body.error.code).toBe("MFA_REQUIRED"); // only boolean true counts
    const withMfa = await request(app)
      .get("/api/admin/users")
      .set(bearer(tokenFor(admin, { mfa: true })));
    expect(withMfa.status).toBe(200);
  });

  it("A35 a citizen does not need MFA for /api/me", async () => {
    const res = await me(signToken({ sub: "auth0|nomfa" }));
    expect(res.status).toBe(200);
  });
});

describe("the 15-minute refresh (A29)", () => {
  const T0 = new Date("2026-03-10T09:00:00.000Z");
  const minutes = (n) => new Date(T0.getTime() + n * 60 * 1000);
  const lastLogin = async (sub) => (await User.collection.findOne({ auth0Ids: sub })).lastLoginAt;

  it("A29 lastLoginAt is written at t0 and t0+16 min only, not at t0+10 min", async () => {
    // Only Date is faked (not timers), so the key server and the database keep working normally.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const token = signToken({ sub: "auth0|throttle" });
    expect((await me(token)).status).toBe(200);
    expect((await lastLogin("auth0|throttle")).getTime()).toBe(T0.getTime());

    vi.setSystemTime(minutes(10));
    expect((await me(token)).status).toBe(200);
    expect((await lastLogin("auth0|throttle")).getTime()).toBe(T0.getTime());

    vi.setSystemTime(minutes(16));
    expect((await me(token)).status).toBe(200);
    expect((await lastLogin("auth0|throttle")).getTime()).toBe(minutes(16).getTime());
  });

  it("A29 14:59 does not write, 15:01 does", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const token = signToken({ sub: "auth0|edge" });
    await me(token);
    vi.setSystemTime(new Date(T0.getTime() + (14 * 60 + 59) * 1000));
    await me(token);
    expect((await lastLogin("auth0|edge")).getTime()).toBe(T0.getTime());
    vi.setSystemTime(new Date(T0.getTime() + (15 * 60 + 1) * 1000));
    await me(token);
    expect((await lastLogin("auth0|edge")).getTime()).toBe(T0.getTime() + (15 * 60 + 1) * 1000);
  });

  it("A29 many racing requests after the window: still one write (one racer wins)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const token = signToken({ sub: "auth0|racers" });
    await me(token);
    vi.setSystemTime(minutes(30));
    const results = await Promise.all(Array.from({ length: 5 }, () => me(token)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect((await lastLogin("auth0|racers")).getTime()).toBe(minutes(30).getTime());
  });

  it("the refresh updates email and avatar from the token but never role, status or name", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const sub = "auth0|refresh";
    await me(signToken({ sub, name: "Original", picture: "https://x.example/1.png" }));
    await User.collection.updateOne({ auth0Ids: sub }, { $set: { name: "Edited by user" } });
    vi.setSystemTime(minutes(20));
    await me(
      signToken({
        sub,
        email: "New@Example.com",
        name: "Renamed in Auth0",
        picture: "https://x.example/2.png",
        role: "super_admin",
      }),
    );
    const row = await User.collection.findOne({ auth0Ids: sub });
    expect(row).toMatchObject({
      email: "new@example.com",
      avatarUrl: "https://x.example/2.png",
      name: "Edited by user",
      role: "citizen",
      status: "active",
    });
  });

  it("a user who verifies their email is updated at once, inside the 15 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const sub = "auth0|verify-now";
    await me(signToken({ sub, email_verified: false }));
    expect((await User.collection.findOne({ auth0Ids: sub })).emailVerified).toBe(false);
    vi.setSystemTime(minutes(2));
    await me(signToken({ sub, email_verified: true }));
    expect((await User.collection.findOne({ auth0Ids: sub })).emailVerified).toBe(true);
  });
});

describe("responses", () => {
  it("GET /api/me is never cached (it holds personal data)", async () => {
    const res = await me(signToken({ sub: "auth0|cache" }));
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("key server outage (A5)", () => {
  // The real createJwtCheck, pointed at a key server that misbehaves, behind the real error handler.
  async function withKeyServer(handler, run) {
    const server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { createJwtCheck } = await import("../../src/middleware/auth.js");
      const { errorHandler } = await import("../../src/middleware/errorHandler.js");
      const jwksUri = `http://127.0.0.1:${server.address().port}/jwks.json`;
      const mini = express();
      mini.get("/x", createJwtCheck({ audience: AUDIENCE, issuer: ISSUER, jwksUri }), (req, res) =>
        res.json({ ok: true }),
      );
      mini.use(errorHandler);
      return await run(mini);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it("A5 key server answers HTTP 500 -> 503 AUTH_PROVIDER_UNAVAILABLE (not 401)", async () => {
    await withKeyServer(
      (req, res) => res.writeHead(500).end("boom"),
      async (mini) => {
        const res = await request(mini).get("/x").set(bearer(signToken()));
        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe("AUTH_PROVIDER_UNAVAILABLE");
      },
    );
  });

  it("A5 key server answers 200 with an HTML body -> 503 AUTH_PROVIDER_UNAVAILABLE", async () => {
    await withKeyServer(
      (req, res) =>
        res.writeHead(200, { "Content-Type": "text/html" }).end("<html>maintenance</html>"),
      async (mini) => {
        const res = await request(mini).get("/x").set(bearer(signToken()));
        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe("AUTH_PROVIDER_UNAVAILABLE");
      },
    );
  });

  it("A5 an unknown kid on a healthy key server stays 401", async () => {
    const keys = await startKeyServer();
    try {
      const { createJwtCheck } = await import("../../src/middleware/auth.js");
      const { errorHandler } = await import("../../src/middleware/errorHandler.js");
      const mini = express();
      mini.get(
        "/x",
        createJwtCheck({ audience: AUDIENCE, issuer: ISSUER, jwksUri: keys.jwksUri }),
        (req, res) => res.json({ ok: true }),
      );
      mini.use(errorHandler);
      const res = await request(mini)
        .get("/x")
        .set(bearer(signToken({ kid: "nope" })));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
      expect((await request(mini).get("/x").set(bearer(signToken()))).status).toBe(200);
    } finally {
      await keys.close();
    }
  });
});

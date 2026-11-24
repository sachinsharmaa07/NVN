import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import {
  ISSUER,
  AUDIENCE,
  startKeyServer,
  signToken,
  signWithWrongKey,
  claims,
  NS,
} from "../helpers/fakeAuth0.js";

vi.mock("../../src/config/db.js", () => ({ isDbUp: () => true }));

// The database functions are faked; the token check, user loading, limits and routes all run for real.
vi.mock("../../src/services/userService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  findByAuth0Id: vi.fn(),
  syncFromToken: vi.fn(),
}));

// Use the real token check, pointed at a local key server instead of Auth0.
const holder = vi.hoisted(() => ({ check: null }));
vi.mock("../../src/middleware/auth.js", async (importOriginal) => ({
  ...(await importOriginal()),
  authenticate: (req, res, next) => holder.check(req, res, next),
}));

const { createJwtCheck } = await import("../../src/middleware/auth.js");
const { findByAuth0Id, syncFromToken } = await import("../../src/services/userService.js");
const { loadUser, requireVerifiedEmail, requirePermission, requireScope } =
  await import("../../src/middleware/access.js");
const { errorHandler, notFound } = await import("../../src/middleware/errorHandler.js");
const { createApp } = await import("../../src/app.js");

let keys;
beforeAll(async () => {
  keys = await startKeyServer();
  holder.check = createJwtCheck({ audience: AUDIENCE, issuer: ISSUER, jwksUri: keys.jwksUri });
});
afterAll(() => keys.close());
beforeEach(() => {
  vi.mocked(findByAuth0Id).mockReset();
  vi.mocked(syncFromToken).mockReset();
});

const app = createApp();
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const record = (extra = {}) => ({
  _id: "64b000000000000000000001",
  auth0Id: "auth0|user-1",
  email: "asha@example.com",
  name: "Asha",
  role: "citizen",
  cityId: null,
  departmentId: null,
  status: "active",
  ...extra,
});

describe("token check (GET /api/me)", () => {
  it("no token -> 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHENTICATED", message: expect.any(String) } });
  });

  it.each([
    ["wrong audience", () => signToken({ aud: "https://other-api" })],
    ["wrong issuer", () => signToken({ iss: "https://evil.example/" })],
    ["expired", () => signToken({ exp: Math.floor(Date.now() / 1000) - 3600 })],
    ["signed with another key", () => signWithWrongKey({})],
    ["HS256 instead of RS256", () => signToken({}, { header: { alg: "HS256" } })],
    ['alg "none"', () => signToken({}, { header: { alg: "none" } })],
    ["not a JWT at all", () => "garbage"],
  ])("%s -> 401 and no detail about why", async (name, makeToken) => {
    const res = await request(app).get("/api/me").set(bearer(makeToken()));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(JSON.stringify(res.body)).not.toMatch(/audience|issuer|signature|expired|alg/i);
  });

  it("an unknown query parameter -> 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .get("/api/me?role=super_admin")
      .set(bearer(signToken(claims())));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/me", () => {
  it("creates or refreshes the user from the token's claims and returns role from the database", async () => {
    vi.mocked(syncFromToken).mockResolvedValue(record());
    const res = await request(app)
      .get("/api/me")
      .set(bearer(signToken(claims())));
    expect(res.status).toBe(200);
    expect(syncFromToken).toHaveBeenCalledWith({
      auth0Id: "auth0|user-1",
      email: "asha@example.com",
      name: "Asha",
      emailVerified: true,
    });
    expect(res.body.user).toEqual({
      id: "64b000000000000000000001",
      email: "asha@example.com",
      name: "Asha",
      role: "citizen",
      level: 1,
      cityId: null,
      departmentId: null,
      emailVerified: true,
    });
    expect(res.body.user.auth0Id).toBeUndefined();
  });

  it("ignores any role the token claims: the database decides", async () => {
    vi.mocked(syncFromToken).mockResolvedValue(record());
    const token = signToken(claims({ role: "super_admin", [`${NS}roles`]: ["super_admin"] }));
    const res = await request(app).get("/api/me").set(bearer(token));
    expect(res.body.user.role).toBe("citizen");
    // Nothing from the token's role claims ever reaches the service.
    expect(JSON.stringify(vi.mocked(syncFromToken).mock.calls)).not.toMatch(/super_admin/);
  });

  it("an unverified token claim is reported as emailVerified false", async () => {
    vi.mocked(syncFromToken).mockResolvedValue(record());
    const token = signToken(claims({ [`${NS}email_verified`]: "true" })); // a string is not `true`
    const res = await request(app).get("/api/me").set(bearer(token));
    expect(res.body.user.emailVerified).toBe(false);
  });

  it("a suspended account -> 403 ACCOUNT_SUSPENDED, and its record is not written to", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(record({ status: "suspended" }));
    const res = await request(app)
      .get("/api/me")
      .set(bearer(signToken(claims())));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
    expect(syncFromToken).not.toHaveBeenCalled();
  });

  it("is never cached (it holds personal data)", async () => {
    vi.mocked(syncFromToken).mockResolvedValue(record());
    const res = await request(app)
      .get("/api/me")
      .set(bearer(signToken(claims())));
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("a claim that is not a string counts as missing -> 401 TOKEN_CLAIMS_MISSING", async () => {
    const { syncFromToken: real } = await vi.importActual("../../src/services/userService.js");
    vi.mocked(syncFromToken).mockImplementation(real);
    const res = await request(app)
      .get("/api/me")
      .set(bearer(signToken(claims({ [`${NS}email`]: { $ne: null } }))));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_CLAIMS_MISSING");
  });

  it("a token without our email claim -> 401 TOKEN_CLAIMS_MISSING", async () => {
    const { syncFromToken: real } = await vi.importActual("../../src/services/userService.js");
    vi.mocked(syncFromToken).mockImplementation(real);
    const res = await request(app)
      .get("/api/me")
      .set(bearer(signToken({})));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_CLAIMS_MISSING");
  });
});

describe("POST /api/me/resend-verification", () => {
  const post = (token) => request(app).post("/api/me/resend-verification").set(bearer(token));
  const unverified = (sub) => signToken({ sub, ...claims({ [`${NS}email_verified`]: false }) });

  it("a user who never called /api/me -> 403 USER_NOT_REGISTERED", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(null);
    const res = await post(unverified("auth0|new"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("USER_NOT_REGISTERED");
  });

  it("a suspended user -> 403 ACCOUNT_SUSPENDED", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(record({ status: "suspended" }));
    const res = await post(unverified("auth0|s"));
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("already verified -> 409 ALREADY_VERIFIED", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(record());
    const res = await post(signToken(claims()));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_VERIFIED");
  });

  it("unverified -> 503 RESEND_UNAVAILABLE while the Auth0 call is a stub", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(record());
    const res = await post(unverified("auth0|user-2"));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("RESEND_UNAVAILABLE");
  });

  it("the 4th try in an hour -> 429 RATE_LIMITED, counted per user", async () => {
    vi.mocked(findByAuth0Id).mockImplementation(async (sub) => record({ _id: sub, auth0Id: sub }));
    const token = unverified("auth0|spammer");
    for (let i = 0; i < 3; i++) expect((await post(token)).status).toBe(503);
    const limited = await post(token);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    // A different user is not affected.
    expect((await post(unverified("auth0|other"))).status).toBe(503);
  });
});

// A small app that uses the same middleware the Phase 3+ routes will use.
describe("protecting a route: verified email, permission and scope", () => {
  const guarded = express();
  guarded.post(
    "/cities/:cityId/assign",
    (req, res, next) => holder.check(req, res, next),
    loadUser,
    requireVerifiedEmail,
    requirePermission("issue:assign"),
    requireScope((req) => ({ cityId: req.params.cityId })),
    (req, res) => res.json({ ok: true, by: req.user.role }),
  );
  guarded.use(notFound, errorHandler);

  const call = (token, cityId = "c1") =>
    request(guarded).post(`/cities/${cityId}/assign`).set(bearer(token));
  const admin = (extra) => record({ role: "city_admin", cityId: "c1", ...extra });

  it("no token -> 401", async () => {
    expect((await request(guarded).post("/cities/c1/assign")).status).toBe(401);
  });

  it("unverified email -> 403 EMAIL_NOT_VERIFIED", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(admin());
    const res = await call(signToken(claims({ [`${NS}email_verified`]: false })));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("a citizen on an admin route -> 403 FORBIDDEN (wrong level)", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(record());
    const res = await call(signToken(claims()));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("a city admin of another city -> 403 FORBIDDEN (wrong scope)", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(admin());
    const res = await call(signToken(claims()), "c2");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("a city admin in their own city -> 200", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(admin());
    const res = await call(signToken(claims()));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, by: "city_admin" });
  });

  it("a suspended admin with a still-valid token -> 403 ACCOUNT_SUSPENDED", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(admin({ status: "suspended" }));
    const res = await call(signToken(claims()));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("a role claim in the token cannot grant access the database role lacks", async () => {
    vi.mocked(findByAuth0Id).mockResolvedValue(record());
    const token = signToken(claims({ role: "city_admin", [`${NS}roles`]: ["city_admin"] }));
    expect((await call(token)).status).toBe(403);
  });

  it("a demotion in the database applies on the very next request", async () => {
    const token = signToken(claims());
    vi.mocked(findByAuth0Id).mockResolvedValue(admin());
    expect((await call(token)).status).toBe(200);
    vi.mocked(findByAuth0Id).mockResolvedValue(admin({ role: "citizen" }));
    expect((await call(token)).status).toBe(403);
  });
});

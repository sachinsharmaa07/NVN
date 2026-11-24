// A33: every kind of failure leaves the server in the one standard shape, and none of them leaks
// internals. Driven through the real app, real token check and real database.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { signToken } from "../helpers/fakeAuth0.js";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, seedWorld, seedUser, tokenFor, bearer } from "../helpers/testDb.js";
import { resetMgmt, failNext, request as mgmtRequest } from "../helpers/mgmtMock.js";

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

const LEAK =
  /stack|node_modules|mongodb(\+srv)?:\/\/|client_secret|hunter2|eyJ[A-Za-z0-9_-]{10,}|\bat\s+\S+\s+\(.*:\d+:\d+\)|MongoServerError|ValidationError|CastError|ECONN/;
const OK_KEYS = new Set(["code", "message", "details", "requestId"]);

function expectStandardShape(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.headers["content-type"]).toMatch(/application\/json/);
  expect(Object.keys(res.body)).toEqual(["error"]);
  const { error } = res.body;
  expect(error.code).toBe(code);
  expect(error.code).toMatch(/^[A-Z][A-Z0-9_]+$/);
  expect(typeof error.message).toBe("string");
  expect(error.message.length).toBeGreaterThan(0);
  for (const key of Object.keys(error))
    expect(OK_KEYS.has(key), `unexpected key ${key}`).toBe(true);
  expect(res.text).not.toMatch(LEAK);
  expect(res.headers["x-request-id"]).toBeTruthy();
}

describe("A33 error shape and leakage", () => {
  it("401 no token", async () => {
    expectStandardShape(await request(app).get("/api/me"), 401, "UNAUTHENTICATED");
  });

  it("401 TOKEN_CLAIMS_MISSING", async () => {
    const res = await request(app)
      .get("/api/me")
      .set(bearer(signToken({ email: null, sub: "auth0|x" })));
    expectStandardShape(res, 401, "TOKEN_CLAIMS_MISSING");
  });

  it("403 FORBIDDEN", async () => {
    const citizen = await seedUser("citizen");
    const res = await request(app)
      .get("/api/admin/users")
      .set(bearer(tokenFor(citizen)));
    expectStandardShape(res, 403, "FORBIDDEN");
  });

  it("403 EMAIL_NOT_VERIFIED, MFA_REQUIRED and SUSPENDED", async () => {
    const { cityA } = await seedWorld();
    const admin = await seedUser("city_admin", { cityId: cityA._id });
    const get = (claims) =>
      request(app)
        .get("/api/admin/users")
        .set(bearer(tokenFor(admin, claims)));
    expectStandardShape(await get({ email_verified: false }), 403, "EMAIL_NOT_VERIFIED");
    expectStandardShape(await get({ mfa: undefined }), 403, "MFA_REQUIRED");
    const suspended = await seedUser(
      "citizen",
      {},
      {
        status: "suspended",
        suspendedReason: "spam links",
        suspendedAt: new Date(),
        suspendedBy: admin._id,
      },
    );
    const res = await request(app)
      .get("/api/me")
      .set(bearer(tokenFor(suspended)));
    expectStandardShape(res, 403, "SUSPENDED");
    expect(res.body.error.details).toEqual({ reason: "spam links" });
  });

  it("404 unknown route and 404 out of scope", async () => {
    expectStandardShape(await request(app).get("/api/nope"), 404, "NOT_FOUND");
    const { cityA, cityB } = await seedWorld();
    const admin = await seedUser("city_admin", { cityId: cityA._id });
    const other = await seedUser("moderator", { cityId: cityB._id });
    const res = await request(app)
      .patch(`/api/admin/users/${other._id}/status`)
      .set(bearer(tokenFor(admin)))
      .send({ status: "suspended", reason: "valid reason" });
    expectStandardShape(res, 404, "NOT_FOUND");
  });

  it("400 validation (fields named, nothing internal), bad JSON, bad id", async () => {
    const user = await seedUser("citizen");
    const token = tokenFor(user);
    const bad = await request(app)
      .patch("/api/me")
      .set(bearer(token))
      .send({ role: "super_admin" });
    expectStandardShape(bad, 400, "VALIDATION_ERROR");
    expect(Array.isArray(bad.body.error.details)).toBe(true);
    const json = await request(app)
      .patch("/api/me")
      .set(bearer(token))
      .set("Content-Type", "application/json")
      .send('{"name": ');
    expectStandardShape(json, 400, "INVALID_JSON");
    const { cityA } = await seedWorld();
    const admin = await seedUser("city_admin", { cityId: cityA._id });
    const id = await request(app)
      .patch("/api/admin/users/not-an-id/role")
      .set(bearer(tokenFor(admin)))
      .send({ role: "moderator", reason: "valid reason" });
    expectStandardShape(id, 400, "VALIDATION_ERROR");
  });

  it("429 RATE_LIMITED", async () => {
    const user = await seedUser("citizen", {}, { emailVerified: false });
    const token = tokenFor(user, { email_verified: false });
    let res;
    for (let i = 0; i < 4; i++)
      res = await request(app).post("/api/me/resend-verification").set(bearer(token));
    expectStandardShape(res, 429, "RATE_LIMITED");
  });

  it("503 AUTH_PROVIDER_UNAVAILABLE", async () => {
    const user = await seedUser("citizen", {}, { emailVerified: false });
    await failNext("network");
    const res = await request(app)
      .post("/api/me/resend-verification")
      .set(bearer(tokenFor(user, { email_verified: false })));
    expectStandardShape(res, 503, "AUTH_PROVIDER_UNAVAILABLE");
  });

  it("500 an unhandled throw: generic message, request id, no stack, secret or connection string", async () => {
    const user = await seedUser("citizen", {}, { emailVerified: false });
    mgmtRequest.mockRejectedValueOnce(
      new Error(
        "boom mongodb://admin:hunter2@db.example/prod client_secret=hunter2\n    at Object.<anonymous> (/app/node_modules/x/index.js:1:1)",
      ),
    );
    const res = await request(app)
      .post("/api/me/resend-verification")
      .set(bearer(tokenFor(user, { email_verified: false })));
    expectStandardShape(res, 500, "INTERNAL_ERROR");
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
    expect(res.text).not.toContain("boom");
  });
});

// One user, many sign-in ids: a new `sub` joins the user with the same VERIFIED email, never an
// unverified one. Admins link fail-closed (Auth0 MFA flag first). Only the Auth0 client is mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { signToken } from "../helpers/fakeAuth0.js";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, seedUser, seedWorld, tokenFor, bearer } from "../helpers/testDb.js";
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
let app;
beforeEach(() => {
  app = createApp();
});
useFakeAuth0();
useTestDb();
beforeEach(resetMgmt);

const me = (token) => request(app).get("/api/me").set(bearer(token));
const rows = () => User.collection.find({}).toArray();
const linkAudits = () => AuditLog.find({ action: "user.identity_linked" }).lean();
const otp = (user, extra = {}) =>
  signToken({ sub: "email|otp-1", email: user.email, email_verified: true, ...extra });

describe("verified-email linking", () => {
  it("a new verified sign-in id joins the existing user, with one audit row", async () => {
    const user = await seedUser("citizen");
    const res = await me(otp(user));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(String(user._id));
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0].auth0Ids).toEqual([user.auth0Ids[0], "email|otp-1"]);
    const audits = await linkAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorLabel: "auth:link", after: { provider: "email" } });
    // The second request with that id finds it directly: no second link, no second audit row.
    await me(otp(user));
    expect(await linkAudits()).toHaveLength(1);
  });

  it("an unverified token email is never linked: a separate citizen is created", async () => {
    const user = await seedUser("citizen");
    const res = await me(otp(user, { email_verified: false }));
    expect(res.status).toBe(200);
    expect(res.body.user.id).not.toBe(String(user._id));
    expect((await User.collection.findOne({ _id: user._id })).auth0Ids).toEqual(user.auth0Ids);
    expect(await linkAudits()).toHaveLength(0);
  });

  it("a verified token never links to an unverified row", async () => {
    const user = await seedUser("citizen", {}, { emailVerified: false });
    const res = await me(otp(user));
    expect(res.status).toBe(200);
    expect(res.body.user.id).not.toBe(String(user._id));
    expect(await linkAudits()).toHaveLength(0);
  });

  it("two concurrent first sign-ins with one verified email make one user (x10 runs)", async () => {
    for (let run = 0; run < 10; run++) {
      await User.collection.deleteMany({});
      const email = `pair${run}@example.com`;
      const google = signToken({ sub: `google-oauth2|${run}`, email, email_verified: true });
      const code = signToken({ sub: `email|${run}`, email, email_verified: true });
      const [a, b] = await Promise.all([me(google), me(code)]);
      expect([a.status, b.status], `run ${run}`).toEqual([200, 200]);
      expect(a.body.user.id, `run ${run}`).toBe(b.body.user.id);
      const all = await rows();
      expect(all, `run ${run}`).toHaveLength(1);
      expect([...all[0].auth0Ids].sort()).toEqual([`email|${run}`, `google-oauth2|${run}`]);
    }
  });
});

describe("admins link fail-closed", () => {
  it("the MFA flag is set on the new id before it is linked; admin routes still need the mfa claim", async () => {
    const { cityA } = await seedWorld();
    const admin = await seedUser("city_admin", { cityId: cityA._id });
    let idsWhenFlagSet;
    mgmtRequest.mockImplementationOnce(async () => {
      idsWhenFlagSet = (await User.collection.findOne({ _id: admin._id })).auth0Ids;
      return {};
    });
    expect((await me(otp(admin))).status).toBe(200);
    expect(mfaCalls()).toEqual([{ auth0Id: "email|otp-1", flag: true }]);
    expect(idsWhenFlagSet).toEqual(admin.auth0Ids); // flag first, link second
    const noMfa = await request(app)
      .get("/api/admin/users")
      .set(bearer(otp(admin)));
    expect(noMfa.body.error.code).toBe("MFA_REQUIRED");
  });

  it("when Auth0 fails the link is refused: 503 and nothing changes", async () => {
    const { cityA } = await seedWorld();
    const admin = await seedUser("city_admin", { cityId: cityA._id });
    await failNext("upstream", 5); // enough to outlast the client's own retries
    const res = await me(otp(admin));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AUTH_PROVIDER_UNAVAILABLE");
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0].auth0Ids).toEqual(admin.auth0Ids);
    expect(await linkAudits()).toHaveLength(0);
  });

  it("promoting a user with two sign-in ids sets the flag on both", async () => {
    const { cityA, deptA1 } = await seedWorld();
    const root = await seedUser("super_admin");
    const staff = await seedUser(
      "staff",
      { cityId: cityA._id, departmentId: deptA1._id },
      { auth0Ids: ["google-oauth2|s", "email|s"] },
    );
    const res = await request(app)
      .patch(`/api/admin/users/${staff._id}/role`)
      .set(bearer(tokenFor(root)))
      .send({
        role: "dept_head",
        cityId: String(cityA._id),
        departmentId: String(deptA1._id),
        reason: "runs the roads department",
      });
    expect(res.status).toBe(200);
    expect(mfaCalls()).toEqual([
      { auth0Id: "google-oauth2|s", flag: true },
      { auth0Id: "email|s", flag: true },
    ]);
  });
});

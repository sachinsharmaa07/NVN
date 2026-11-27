// GET /api/admin/cities (status filter, cursor pages) and GET /api/admin/waitlist (demand by pincode).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, seedIssueWorld } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { City } = await import("../../src/models/City.js");
const { Pincode } = await import("../../src/models/Pincode.js");
const { Waitlist } = await import("../../src/models/Waitlist.js");

useTestDb();
useFakeAuth0();
const app = createApp();

let w;
beforeEach(async () => {
  w = await seedIssueWorld(); // Kapurthala and Pune, both active
  await City.create([
    { name: "Amritsar", code: "PB-AMRITSAR", stateCode: "PB" }, // onboarding by default
    { name: "Bathinda", code: "PB-BATHINDA", stateCode: "PB" },
  ]);
});

const hash = (n) => String(n).padStart(64, "0");

describe("GET /api/admin/cities", () => {
  it("filters by status and returns status on every row", async () => {
    const res = await as(app, w.root).get("/api/admin/cities?status=onboarding");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.items).toEqual([
      expect.objectContaining({ name: "Amritsar", code: "PB-AMRITSAR", status: "onboarding" }),
      expect.objectContaining({ name: "Bathinda", stateCode: "PB", status: "onboarding" }),
    ]);
  });

  it("pages by cursor with no overlap", async () => {
    const seen = [];
    let cursor = "";
    for (let page = 0; page < 5; page += 1) {
      const res = await as(app, w.root).get(`/api/admin/cities?stateCode=PB&limit=1${cursor}`);
      seen.push(...res.body.items.map((c) => c.name));
      if (!res.body.nextCursor) break;
      cursor = `&cursor=${encodeURIComponent(res.body.nextCursor)}`;
    }
    expect(seen).toEqual(["Amritsar", "Bathinda", "Kapurthala"]);
  });

  it("is super admin only, needs MFA, and refuses unknown filters", async () => {
    expect((await as(app, w.admin).get("/api/admin/cities")).status).toBe(403);
    const noMfa = await as(app, w.root, { mfa: undefined }).get("/api/admin/cities");
    expect(noMfa.status).toBe(403);
    expect(noMfa.body.error.code).toBe("MFA_REQUIRED");
    expect((await as(app, w.root).get("/api/admin/cities?status=paused")).status).toBe(400);
    expect((await as(app, w.root).get("/api/admin/cities?sort=name")).status).toBe(400);
  });
});

describe("GET /api/admin/waitlist", () => {
  beforeEach(async () => {
    await Pincode.create({ pin: "110001", district: "New Delhi", state: "Delhi" });
    await Waitlist.create([
      { pin: "110001", emailHash: hash(1) },
      { pin: "110001", emailHash: hash(2) },
      { pin: "110001", emailHash: hash(3) },
      { pin: "400001", emailHash: hash(4) },
      { pin: "560001", emailHash: hash(5) },
    ]);
  });

  it("counts sign-ups per pincode, most first, ties by pin, never exposing email hashes", async () => {
    const res = await as(app, w.root).get("/api/admin/waitlist?limit=2");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      {
        pin: "110001",
        count: 3,
        latestAt: expect.any(String),
        district: "New Delhi",
        state: "Delhi",
        isServed: false,
      },
      {
        pin: "400001",
        count: 1,
        latestAt: expect.any(String),
        district: null,
        state: null,
        isServed: false,
      },
    ]);
    expect(JSON.stringify(res.body)).not.toContain(hash(1));
  });

  it("is super admin only and refuses a limit over 50", async () => {
    expect((await as(app, w.admin).get("/api/admin/waitlist")).status).toBe(403);
    expect((await as(app, w.root).get("/api/admin/waitlist?limit=51")).status).toBe(400);
  });
});

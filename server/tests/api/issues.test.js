// POST /api/issues and GET /api/issues/:ticketId (M1 step 8) on a real replica set.
// Kapurthala 144601 has no polygon here, so pins are checked against its 4 km circle.
import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, seedUser, tokenFor, bearer } from "../helpers/testDb.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { City } = await import("../../src/models/City.js");
const { Pincode } = await import("../../src/models/Pincode.js");
const { Department } = await import("../../src/models/Department.js");
const { CategoryMapping } = await import("../../src/models/CategoryMapping.js");
const { SlaPolicy } = await import("../../src/models/SlaPolicy.js");
const { Issue } = await import("../../src/models/Issue.js");
const { AuditLog } = await import("../../src/models/AuditLog.js");
const { Counter } = await import("../../src/models/Counter.js");

useTestDb();
useFakeAuth0();
const app = createApp();

const NOW = new Date("2026-11-26T06:30:00Z"); // noon IST
const HOUR = 3600_000;
const INSIDE = { lat: 31.38, lng: 75.39 }; // about 1 km east of the centroid
const OUTSIDE = { lat: 31.38, lng: 75.45 }; // about 6.7 km east
const PHOTO = "nivaran/test/reports/abc123";

let world;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  const city = await City.create({ name: "Kapurthala", code: "PB-KAPURTHALA", stateCode: "PB" });
  const roads = await Department.create({ cityId: city._id, name: "Roads", code: "ROADS" });
  await CategoryMapping.create([
    { cityId: city._id, category: "pothole", departmentId: roads._id, queue: "department" },
    { cityId: city._id, category: "other", queue: "triage" },
  ]);
  await SlaPolicy.create([
    { category: "pothole", cityId: null, respondHours: 24, resolveHours: 168 },
    { category: "other", cityId: null, respondHours: 48, resolveHours: 168 },
  ]);
  const base = { district: "Kapurthala", state: "Punjab", cityId: city._id, isServed: true };
  await Pincode.create([
    {
      ...base,
      pin: "144601",
      centroid: { type: "Point", coordinates: [75.38, 31.38] },
      radiusM: 4000,
    },
    { pin: "110001", district: "New Delhi", state: "Delhi" }, // known, not served
  ]);
  world = { city, roads, citizen: await seedUser("citizen"), other: await seedUser("citizen") };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const body = (over = {}) => ({
  pincode: "144601",
  ...INSIDE,
  category: "pothole",
  title: "Deep pothole",
  description: "A deep pothole outside the bus stand, two feet wide.",
  ...over,
});
const submit = (payload, { user = world.citizen, key = randomUUID() } = {}) =>
  request(app)
    .post("/api/issues")
    .set(bearer(tokenFor(user)))
    .set("Idempotency-Key", key)
    .send(payload);
/** Cloudinary Admin API answering for our photo; anything else is a 404. */
const cloudinaryHas = (asset) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      url.endsWith(PHOTO)
        ? new Response(JSON.stringify(asset), { status: 200 })
        : new Response("{}", { status: 404 }),
    ),
  );

describe("POST /api/issues", () => {
  it("creates a routed issue in one go: ticket, department, expectedBy, history, audit", async () => {
    cloudinaryHas({ bytes: 1000, format: "jpg", width: 1600, height: 1200 });
    const res = await submit(body({ photos: [PHOTO] }));
    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toMatchObject({
      ticketId: "NIV-2026-000001",
      status: "submitted",
      queue: "department",
      precision: "approx",
      department: { id: String(world.roads._id), name: "Roads" },
      expectedBy: new Date(NOW.getTime() + 168 * HOUR).toISOString(),
    });
    const stored = await Issue.findOne({ ticketId: "NIV-2026-000001" }).lean();
    expect(stored.photos).toEqual([{ publicId: PHOTO, width: 1600, height: 1200 }]);
    expect(stored.location.coordinates).toEqual([INSIDE.lng, INSIDE.lat]);
    expect(stored.statusHistory).toMatchObject([{ status: "submitted" }]);
    const audit = await AuditLog.findOne({ action: "issue.created" }).lean();
    expect(audit).toMatchObject({
      targetType: "issue",
      targetId: stored._id,
      cityId: world.city._id,
    });
    expect(audit.after).toEqual({
      ticketId: "NIV-2026-000001",
      category: "pothole",
      queue: "department",
      departmentId: world.roads._id,
    });
  });

  it("sends 'other' to the city triage queue", async () => {
    const res = await submit(body({ category: "other" }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ queue: "triage", department: null });
  });

  it("a city's SLA policy wins over the national default", async () => {
    await SlaPolicy.create({
      category: "pothole",
      cityId: world.city._id,
      respondHours: 12,
      resolveHours: 72,
    });
    const res = await submit(body());
    expect(res.body.expectedBy).toBe(new Date(NOW.getTime() + 72 * HOUR).toISOString());
  });

  it("the same key again returns the first issue with 200, even with a different body", async () => {
    const key = randomUUID();
    const first = await submit(body(), { key });
    const again = await submit(body({ title: "Changed title" }), { key });
    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
    expect(await Issue.countDocuments()).toBe(1);
  });

  it("a double tap (same key in parallel) makes one issue", async () => {
    const key = randomUUID();
    const answers = await Promise.all([submit(body(), { key }), submit(body(), { key })]);
    expect(answers.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(new Set(answers.map((r) => r.body.ticketId)).size).toBe(1);
    expect(await Issue.countDocuments()).toBe(1);
  });

  it("parallel submits get unique, gap-free ticket numbers", async () => {
    const answers = await Promise.all(Array.from({ length: 8 }, () => submit(body())));
    expect(answers.every((r) => r.status === 201)).toBe(true);
    const numbers = answers.map((r) => Number(r.body.ticketId.slice(-6))).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("the same key from another user is a separate issue", async () => {
    const key = randomUUID();
    await submit(body(), { key });
    expect((await submit(body(), { key, user: world.other })).status).toBe(201);
  });

  it("a pin outside the pincode is 422 OUTSIDE_PINCODE and takes no ticket number", async () => {
    const res = await submit(body(OUTSIDE));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("OUTSIDE_PINCODE");
    expect(await Issue.countDocuments()).toBe(0);
    expect(await Counter.countDocuments()).toBe(0);
  });

  it("an unserved pincode is 422 PINCODE_NOT_SERVED; an unknown one 404", async () => {
    expect((await submit(body({ pincode: "110001" }))).body.error.code).toBe("PINCODE_NOT_SERVED");
    expect((await submit(body({ pincode: "999999" }))).status).toBe(404);
  });

  it("a foreign photo is 400 INVALID_PHOTO before Cloudinary is asked", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await submit(body({ photos: ["someone/else/x"] }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "INVALID_PHOTO", details: { index: 0 } });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await Issue.countDocuments()).toBe(0);
  });

  it("an oversized photo is 400 INVALID_PHOTO and no issue is written", async () => {
    cloudinaryHas({ bytes: 9_000_000, format: "jpg", width: 1, height: 1 });
    const res = await submit(body({ photos: [PHOTO] }));
    expect(res.body.error.code).toBe("INVALID_PHOTO");
    expect(await Issue.countDocuments()).toBe(0);
  });

  it("4 photos, a short description, or an extra field is 400 VALIDATION_ERROR", async () => {
    for (const payload of [
      body({ photos: [PHOTO, PHOTO, PHOTO, PHOTO] }),
      body({ description: "too short" }),
      body({ status: "resolved" }),
    ]) {
      const res = await submit(payload);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("needs an Idempotency-Key that is a UUID", async () => {
    const res = await submit(body(), { key: "not-a-uuid" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_IDEMPOTENCY_KEY");
  });

  it("needs a verified email", async () => {
    const unverified = await seedUser("citizen", {}, { emailVerified: false });
    expect((await submit(body(), { user: unverified })).status).toBe(403);
  });
});

describe("GET /api/issues/:ticketId", () => {
  const get = (ticketId, user) =>
    request(app)
      .get(`/api/issues/${ticketId}`)
      .set(bearer(tokenFor(user)));

  it("the reporter reads their issue", async () => {
    const created = await submit(body());
    const res = await get(created.body.ticketId, world.citizen);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created.body);
  });

  it("another user's ticket and a missing ticket are the same 404", async () => {
    const created = await submit(body());
    const theirs = await get(created.body.ticketId, world.other);
    const missing = await get("NIV-2026-999999", world.other);
    expect(theirs.status).toBe(404);
    expect(theirs.body).toEqual(missing.body);
  });

  it("a malformed ticket id is 400", async () => {
    expect((await get("NIV-1", world.citizen)).status).toBe(400);
  });
});

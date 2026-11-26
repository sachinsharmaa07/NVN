// GET /api/pincodes/:pin and POST /api/waitlist: report step 1.
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { useTestDb } from "../helpers/testDb.js";
import { createApp } from "../../src/app.js";
import { Pincode } from "../../src/models/Pincode.js";
import { City } from "../../src/models/City.js";
import { Waitlist } from "../../src/models/Waitlist.js";

useTestDb();
const app = createApp();

beforeEach(async () => {
  const city = await City.create({ name: "Kapurthala", code: "PB-KAPURTHALA", stateCode: "PB" });
  await Pincode.create([
    {
      pin: "144601",
      district: "Kapurthala",
      state: "Punjab",
      cityId: city._id,
      isServed: true,
      localities: ["Kapurthala", "Sultanpur Road"],
      centroid: { type: "Point", coordinates: [75.38, 31.38] },
      radiusM: 4000,
    },
    { pin: "110001", district: "New Delhi", state: "Delhi" },
  ]);
});

describe("GET /api/pincodes/:pin", () => {
  it("a served pincode returns everything step 1 and the map need, cacheable for a day", async () => {
    const res = await request(app).get("/api/pincodes/144601");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=86400");
    expect(res.body).toEqual({
      pin: "144601",
      district: "Kapurthala",
      state: "Punjab",
      cityName: "Kapurthala",
      localities: ["Kapurthala", "Sultanpur Road"],
      centroid: { type: "Point", coordinates: [75.38, 31.38] },
      radiusM: 4000,
      boundary: null,
      precision: "approx",
      served: true,
    });
  });

  it("a known unserved pincode is 200 with served: false", async () => {
    const res = await request(app).get("/api/pincodes/110001");
    expect(res.body).toMatchObject({ pin: "110001", cityName: null, served: false });
  });

  it.each([
    ["unknown", "999999", 404, "PINCODE_NOT_FOUND"],
    ["leading zero", "044401", 400, "INVALID_PINCODE"],
    ["letters", "14a601", 400, "INVALID_PINCODE"],
    ["five digits", "14460", 400, "INVALID_PINCODE"],
  ])("%s", async (_, pin, status, code) => {
    const res = await request(app).get(`/api/pincodes/${pin}`);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });
});

describe("POST /api/waitlist", () => {
  const join = (body) => request(app).post("/api/waitlist").send(body);

  it("stores only a hash, and a repeat (any case) is the same 200 with no second row", async () => {
    expect((await join({ pin: "110001", email: "Asha@Example.com" })).body).toEqual({
      joined: true,
    });
    const again = await join({ pin: "110001", email: "asha@example.com" });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ joined: true });
    const rows = await Waitlist.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain("asha");
  });

  it.each([
    ["bad email", { pin: "110001", email: "nope" }],
    ["bad pin", { pin: "011001", email: "a@b.co" }],
    ["extra field", { pin: "110001", email: "a@b.co", name: "x" }],
  ])("%s is 400", async (_, body) => {
    const res = await join(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

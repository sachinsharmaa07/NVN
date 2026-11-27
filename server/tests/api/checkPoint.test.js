// POST /api/pincodes/:pin/check-point: polygon when one exists ("exact"), radius circle otherwise ("approx").
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { useTestDb } from "../helpers/testDb.js";
import { createApp } from "../../src/app.js";
import { Pincode } from "../../src/models/Pincode.js";
import { City } from "../../src/models/City.js";
import { importBoundaries } from "../../src/services/boundaryImportService.js";

useTestDb();
const app = createApp();
const check = (pin, body) => request(app).post(`/api/pincodes/${pin}/check-point`).send(body);
const fixture = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

beforeEach(async () => {
  const city = await City.create({
    name: "Kapurthala",
    code: "PB-KAPURTHALA",
    stateCode: "PB",
    status: "active",
  });
  const base = { district: "Kapurthala", state: "Punjab", cityId: city._id, isServed: true };
  const centroid = (lng, lat) => ({ type: "Point", coordinates: [lng, lat] });
  await Pincode.create([
    { ...base, pin: "144401", centroid: centroid(75.7752, 31.2235), radiusM: 3000 },
    { ...base, pin: "144403", centroid: centroid(75.75, 31.26), radiusM: 5000 },
    { pin: "110001", district: "New Delhi", state: "Delhi" }, // known, not served
  ]);
});

describe("check-point without a polygon: radius circle", () => {
  it("inside the circle is approx and inside", async () => {
    const res = await check("144403", { lat: 31.26, lng: 75.79 }); // about 3.8 km east
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inside: true, precision: "approx" });
  });

  it("outside the circle is approx and not inside", async () => {
    const res = await check("144403", { lat: 31.26, lng: 75.81 }); // about 5.7 km east
    expect(res.body).toEqual({ inside: false, precision: "approx" });
  });
});

describe("check-point with a polygon: exact", () => {
  beforeEach(async () => {
    const geojson = JSON.parse(await readFile(fixture("phagwara.geojson"), "utf8"));
    geojson.features = geojson.features.filter((f) => f.properties.pincode === "144401");
    expect(await importBoundaries({ geojson, apply: true })).toMatchObject({ updated: 1 });
  });

  it("inside the polygon is exact and inside", async () => {
    const res = await check("144401", { lat: 31.22, lng: 75.77 });
    expect(res.body).toEqual({ inside: true, precision: "exact" });
  });

  it("inside the old radius but outside the polygon is NOT inside: the polygon wins", async () => {
    // 75.795 is about 1.9 km from the centroid (inside 3 km) but east of the polygon's 75.79 edge.
    const res = await check("144401", { lat: 31.225, lng: 75.795 });
    expect(res.body).toEqual({ inside: false, precision: "exact" });
  });
});

describe("check-point errors", () => {
  it("a served pincode in an onboarding city is 422 PINCODE_NOT_SERVED", async () => {
    const city = await City.create({ name: "Phagwara", code: "PB-PHAGWARA", stateCode: "PB" });
    await Pincode.updateOne({ pin: "144401" }, { cityId: city._id });
    const res = await check("144401", { lat: 31.22, lng: 75.77 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PINCODE_NOT_SERVED");
  });

  it.each([
    ["unknown pincode", "999999", { lat: 31, lng: 75 }, 404, "PINCODE_NOT_FOUND"],
    ["pincode not served", "110001", { lat: 28.6, lng: 77.2 }, 422, "PINCODE_NOT_SERVED"],
    ["bad pincode", "044401", { lat: 31, lng: 75 }, 400, "VALIDATION_ERROR"],
    ["latitude out of range", "144401", { lat: 91, lng: 75 }, 400, "VALIDATION_ERROR"],
    ["string coordinates", "144401", { lat: "31", lng: "75" }, 400, "VALIDATION_ERROR"],
    ["extra field", "144401", { lat: 31, lng: 75, radius: 1 }, 400, "VALIDATION_ERROR"],
  ])("%s", async (_, pin, body, status, code) => {
    const res = await check(pin, body);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });
});

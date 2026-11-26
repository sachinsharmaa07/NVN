// Pincode and Waitlist validators, checked with validate() (no database needed). Not validateSync:
// it skips pre("validate") hooks, where the cross-field rules live.
import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { Pincode } from "../../src/models/Pincode.js";
import { Waitlist } from "../../src/models/Waitlist.js";
import { centroidOf, geometryProblems } from "../../src/utils/geo.js";

const square = [
  [75.76, 31.22],
  [75.78, 31.22],
  [75.78, 31.24],
  [75.76, 31.24],
  [75.76, 31.22],
];
const polygon = { type: "Polygon", coordinates: [square] };
const base = { pin: "144401", district: "Kapurthala", state: "Punjab" };
const errorsOf = (fields) =>
  new Pincode({ ...base, ...fields }).validate().then(
    () => ({}),
    (err) => err.errors,
  );

describe("Pincode model", () => {
  it("accepts a plain pincode and a served one with a boundary", async () => {
    expect(await errorsOf({})).toEqual({});
    const cityId = new mongoose.Types.ObjectId();
    expect(
      await errorsOf({ cityId, isServed: true, boundary: polygon, boundarySource: "manual" }),
    ).toEqual({});
  });

  it.each(["", "044401", "14440", "1444011", "14440a"])("rejects pin %j", async (pin) => {
    expect(await errorsOf({ pin })).toHaveProperty("pin");
  });

  it("rejects invalid polygons: open ring, too few points, lat/lon swapped", async () => {
    const open = { type: "Polygon", coordinates: [square.slice(0, 4)] };
    const short = { type: "Polygon", coordinates: [[square[0], square[1], square[0]]] };
    const swapped = { type: "Polygon", coordinates: [square.map(([x, y]) => [y, x])] };
    for (const boundary of [open, short, swapped, { type: "Point", coordinates: [75, 31] }]) {
      expect(await errorsOf({ boundary, boundarySource: "manual" })).toHaveProperty("boundary");
    }
  });

  it('keeps boundarySource "none" exactly when there is no boundary', async () => {
    expect(await errorsOf({ boundarySource: "manual" })).toHaveProperty("boundarySource");
    expect(await errorsOf({ boundary: polygon })).toHaveProperty("boundarySource");
  });

  it("refuses a served pincode without a city", async () => {
    expect(await errorsOf({ isServed: true })).toHaveProperty("cityId");
  });
});

describe("Waitlist model", () => {
  it("stores only a 64-hex HMAC and a valid pin", async () => {
    await new Waitlist({ pin: "144401", emailHash: "ab".repeat(32) }).validate();
    const bad = await new Waitlist({ pin: "", emailHash: "me@example.com" })
      .validate()
      .catch((e) => e);
    expect(Object.keys(bad.errors).sort()).toEqual(["emailHash", "pin"]);
  });
});

describe("geo utils", () => {
  it("finds the centre of a square and of the largest polygon in a MultiPolygon", async () => {
    expect(centroidOf(polygon).coordinates).toEqual([75.77, 31.23]);
    const tiny = [
      [80, 20],
      [80.001, 20],
      [80.001, 20.001],
      [80, 20],
    ];
    const multi = { type: "MultiPolygon", coordinates: [[tiny], [square]] };
    expect(geometryProblems(multi)).toEqual([]);
    expect(centroidOf(multi).coordinates).toEqual([75.77, 31.23]);
  });

  it("rejects a ring with no area", async () => {
    const line = [square[0], square[1], square[0], square[0]];
    expect(geometryProblems({ type: "Polygon", coordinates: [line] })).toEqual([
      "polygon ring 0: ring has no area",
    ]);
  });
});

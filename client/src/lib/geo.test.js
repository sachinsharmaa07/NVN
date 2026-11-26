import { describe, expect, it } from "vitest";
import { areaRings, circleRing, distanceM, insideArea } from "./geo";

const circle = {
  boundary: null,
  centroid: { type: "Point", coordinates: [75.38, 31.38] },
  radiusM: 4000,
};
const square = [
  [75.0, 31.0],
  [75.1, 31.0],
  [75.1, 31.1],
  [75.0, 31.1],
  [75.0, 31.0],
];
const hole = [
  [75.04, 31.04],
  [75.06, 31.04],
  [75.06, 31.06],
  [75.04, 31.06],
  [75.04, 31.04],
];

describe("insideArea", () => {
  it("uses the radius circle when there is no polygon (same cases as the server's check-point test)", () => {
    expect(insideArea(circle, [75.39, 31.38])).toBe(true); // ~1 km east
    expect(insideArea(circle, [75.45, 31.38])).toBe(false); // ~6.7 km east
  });

  it("uses the polygon when there is one, and respects holes", () => {
    const area = { ...circle, boundary: { type: "Polygon", coordinates: [square, hole] } };
    expect(insideArea(area, [75.02, 31.02])).toBe(true);
    expect(insideArea(area, [75.05, 31.05])).toBe(false); // in the hole
    expect(insideArea(area, [75.38, 31.38])).toBe(false); // the circle no longer counts
  });

  it("accepts any part of a MultiPolygon", () => {
    const area = { ...circle, boundary: { type: "MultiPolygon", coordinates: [[square], [hole]] } };
    expect(insideArea(area, [75.05, 31.05])).toBe(true);
  });
});

describe("circleRing", () => {
  it("is closed and every point sits on the radius", () => {
    const ring = circleRing([75.38, 31.38], 4000);
    expect(ring[0]).toEqual(ring.at(-1));
    for (const p of ring) expect(distanceM([75.38, 31.38], p)).toBeCloseTo(4000, -1);
  });

  it("areaRings gives polygon outlines or the circle", () => {
    expect(areaRings({ boundary: { type: "Polygon", coordinates: [square, hole] } })).toEqual([
      square,
    ]);
    expect(areaRings(circle)).toHaveLength(1);
  });
});

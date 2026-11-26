import { describe, it, expect } from "vitest";
import { districtCityCode, stateCodeFor } from "../../src/utils/india.js";
import { circleFor, distanceM } from "../../src/utils/geo.js";

describe("stateCodeFor", () => {
  it.each([
    ["Punjab", "PB"],
    ["PUNJAB", "PB"],
    ["Jammu & Kashmir", "JK"],
    ["JAMMU AND KASHMIR", "JK"],
    ["Andaman & Nicobar Islands", "AN"],
    ["THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU", "DH"],
    ["Pondicherry", "PY"],
    ["Atlantis", null],
  ])("%s -> %s", (name, code) => expect(stateCodeFor(name)).toBe(code));
});

describe("districtCityCode", () => {
  it("slugs the district under the state code", () => {
    expect(districtCityCode("DL", "South West Delhi")).toBe("DL-SOUTH-WEST-DELHI");
    expect(districtCityCode("MH", "Mumbai (Suburban)")).toBe("MH-MUMBAI-SUBURBAN");
  });
});

describe("circleFor", () => {
  it("one place: its own position, minimum radius", () => {
    expect(circleFor([[75.77, 31.22]])).toEqual({
      centroid: { type: "Point", coordinates: [75.77, 31.22] },
      radiusM: 3000,
    });
  });

  it("farthest place + 1500 m, clamped to 25 km", () => {
    const { centroid, radiusM } = circleFor([
      [75.8, 31.21],
      [75.81, 31.25],
    ]);
    expect(radiusM).toBe(Math.round(distanceM(centroid.coordinates, [75.81, 31.25]) + 1500));
    expect(
      circleFor([
        [93.6, 7.5],
        [92.78, 9.23],
      ]).radiusM,
    ).toBe(25000);
  });

  it("distanceM: about 111 km per degree of latitude", () => {
    expect(Math.round(distanceM([77, 28], [77, 29]) / 1000)).toBe(111);
  });
});

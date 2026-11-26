import { describe, it, expect } from "vitest";
import { expectedBy } from "../../src/utils/expectedBy.js";

const at = new Date("2026-11-26T10:00:00Z");

describe("expectedBy", () => {
  it("adds calendar hours, across a month end", () => {
    expect(expectedBy(at, 168).toISOString()).toBe("2026-12-03T10:00:00.000Z");
  });

  it("pushes the deadline back by time on hold", () => {
    expect(expectedBy(at, 48, 90 * 60_000).toISOString()).toBe("2026-11-28T11:30:00.000Z");
  });

  it.each([
    ["no date", "2026-11-26", 24, 0],
    ["invalid date", new Date("x"), 24, 0],
    ["zero hours", at, 0, 0],
    ["negative pause", at, 24, -1],
    ["infinite hours", at, Infinity, 0],
  ])("rejects %s", (_, date, hours, paused) => {
    expect(() => expectedBy(date, hours, paused)).toThrow(TypeError);
  });
});

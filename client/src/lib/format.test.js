import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format";

describe("formatDateTime", () => {
  const now = new Date("2026-11-26T06:30:00Z");

  it("shows IST, an upper-case day period, and no year in the current year", () => {
    expect(formatDateTime("2026-11-29T11:30:00Z", now)).toBe("29 Nov, 5:00 PM");
  });

  it("uses the IST date across midnight UTC and adds another year", () => {
    expect(formatDateTime("2026-12-31T19:00:00Z", now)).toBe("1 Jan 2027, 12:30 AM");
  });
});

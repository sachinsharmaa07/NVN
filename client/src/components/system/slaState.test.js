import { describe, expect, it } from "vitest";
import { formatDuration, getSlaState } from "./slaState";

// A 100-hour window makes percentages easy to read: 1 hour = 1%.
const HOUR = 60 * 60 * 1000;
const startAt = new Date("2026-11-20T00:00:00Z");
const dueAt = new Date(startAt.getTime() + 100 * HOUR);
const at = (hours) => new Date(startAt.getTime() + hours * HOUR);

describe("getSlaState", () => {
  it("is on track at the very start (0% used)", () => {
    const result = getSlaState({ startAt, dueAt, now: startAt });
    expect(result.state).toBe("on_track");
    expect(result.usedPct).toBe(0);
    expect(result.msLeft).toBe(100 * HOUR);
  });

  it("is still on track just under the threshold (74.9%)", () => {
    expect(getSlaState({ startAt, dueAt, now: at(74.9) }).state).toBe("on_track");
  });

  it("is at risk from exactly 75% used", () => {
    expect(getSlaState({ startAt, dueAt, now: at(75) }).state).toBe("at_risk");
  });

  it("is breached once the due time has passed", () => {
    const result = getSlaState({ startAt, dueAt, now: at(101) });
    expect(result.state).toBe("breached");
    expect(result.msLeft).toBe(-HOUR);
  });

  it("accepts ISO strings as well as Dates", () => {
    const result = getSlaState({
      startAt: startAt.toISOString(),
      dueAt: dueAt.toISOString(),
      now: at(80).toISOString(),
    });
    expect(result.state).toBe("at_risk");
  });
});

describe("formatDuration", () => {
  it("uses at most two units, largest first", () => {
    expect(formatDuration(2 * 24 * HOUR + 4 * HOUR + 10 * 60 * 1000)).toBe("2 days 4 hrs");
    expect(formatDuration(3 * HOUR + 20 * 60 * 1000)).toBe("3 hrs 20 min");
    expect(formatDuration(HOUR)).toBe("1 hr");
    expect(formatDuration(30 * 1000)).toBe("less than a minute");
  });

  it("ignores the sign so callers can say 'left' or 'Overdue by'", () => {
    expect(formatDuration(-3 * HOUR)).toBe("3 hrs");
  });
});

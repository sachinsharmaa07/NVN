import { describe, expect, it } from "vitest";
import { nextStatuses } from "./issueRules";

const issue = (status, extra = {}) => ({ status, departmentId: "d1", onHold: false, ...extra });

describe("nextStatuses", () => {
  it("offers only the state machine's edges for the role", () => {
    expect(nextStatuses(issue("submitted"), "staff")).toEqual(["assigned"]);
    expect(nextStatuses(issue("submitted"), "dept_head")).toEqual(["assigned", "rejected"]);
    expect(nextStatuses(issue("in_progress"), "staff")).toEqual(["resolved"]);
    expect(nextStatuses(issue("resolved"), "city_admin")).toEqual([]);
    expect(nextStatuses(issue("closed"), "dept_head")).toEqual([]);
  });

  it("a triage issue reaches assigned only through Assign, and nothing moves on hold", () => {
    expect(nextStatuses(issue("submitted", { departmentId: null }), "city_admin")).toEqual([
      "rejected",
    ]);
    expect(nextStatuses(issue("assigned", { onHold: true }), "staff")).toEqual([]);
    const triage = issue("submitted", { departmentId: null, queue: "triage" });
    expect(nextStatuses(triage, "dept_head")).toEqual([]);
  });
});

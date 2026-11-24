// The pure part of the Phase 1 migration: which stored rows break the scope rules.
import { describe, it, expect } from "vitest";
import { scopeViolations } from "../../src/services/migrationService.js";

describe("scopeViolations", () => {
  it.each([
    ["citizen with nothing", { role: "citizen" }, 0],
    ["citizen with a city", { role: "citizen", cityId: "a" }, 1],
    ["moderator without a city", { role: "moderator" }, 1],
    ["moderator with a city", { role: "moderator", cityId: "a" }, 0],
    ["staff with city only", { role: "staff", cityId: "a" }, 1],
    ["staff with city and department", { role: "staff", cityId: "a", departmentId: "d" }, 0],
    ["state_officer with a state", { role: "state_officer", stateCode: "PB" }, 0],
    ["state_officer with a city", { role: "state_officer", stateCode: "PB", cityId: "a" }, 1],
    ["super_admin with scope", { role: "super_admin", stateCode: "PB" }, 1],
    ["null counts as absent", { role: "citizen", cityId: null }, 0],
  ])("%s", (_n, row, count) => {
    expect(scopeViolations(row)).toHaveLength(count);
  });
  it("an unknown role is reported", () => {
    expect(scopeViolations({ role: "wizard" })[0]).toMatch(/unknown role/);
  });
});

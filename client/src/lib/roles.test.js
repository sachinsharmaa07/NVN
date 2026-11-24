import { describe, expect, it } from "vitest";
import { ROLES, assignableRoles, canRole, hasPermission, levelOf, roleNeeds } from "./roles";

describe("levels", () => {
  it.each(ROLES.map((role, i) => [role, i + 1]))("%s is level %i", (role, level) => {
    expect(levelOf(role)).toBe(level);
  });
  it("an unknown role is level 0", () => expect(levelOf("wizard")).toBe(0));
});

describe("assignableRoles: only roles strictly below the actor, and only with user:promote", () => {
  it.each([
    ["citizen", []],
    ["moderator", []],
    ["staff", []],
    ["dept_head", []],
    ["state_officer", []],
    ["city_admin", ["citizen", "moderator", "staff", "dept_head"]],
    ["super_admin", ["citizen", "moderator", "staff", "dept_head", "city_admin", "state_officer"]],
  ])("%s may assign %j", (actor, expected) => {
    expect(assignableRoles(actor)).toEqual(expected);
  });
});

describe("permissions (display copy of the server matrix)", () => {
  it.each([
    ["citizen", "user:read_scope", false],
    ["moderator", "user:read_scope", false],
    ["city_admin", "user:read_scope", true],
    ["state_officer", "user:read_scope", true],
    ["state_officer", "user:promote", false],
    ["super_admin", "user:suspend", true],
    ["dept_head", "user:suspend", false],
    ["citizen", "issue:create", true],
    ["state_officer", "issue:create", false],
  ])("%s / %s -> %s", (role, permission, expected) => {
    expect(canRole(role, permission)).toBe(expected);
  });

  it("prefers the server's permissions[] over the local matrix", () => {
    expect(
      hasPermission({ role: "citizen", permissions: ["user:read_scope"] }, "user:read_scope"),
    ).toBe(true);
    expect(hasPermission({ role: "city_admin", permissions: [] }, "user:read_scope")).toBe(false);
  });
  it("nobody signed in has nothing", () => expect(hasPermission(null, "public:read")).toBe(false));
});

describe("roleNeeds", () => {
  it.each([
    ["citizen", { city: false, department: false, state: false }],
    ["moderator", { city: true, department: false, state: false }],
    ["staff", { city: true, department: true, state: false }],
    ["dept_head", { city: true, department: true, state: false }],
    ["city_admin", { city: true, department: false, state: false }],
    ["state_officer", { city: false, department: false, state: true }],
    ["super_admin", { city: false, department: false, state: false }],
  ])("%s needs %j", (role, needs) => expect(roleNeeds(role)).toEqual(needs));
});

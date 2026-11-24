import { describe, it, expect } from "vitest";
import { ROLES, levelOf, hasPermission, inScope, canAssignRole } from "../../src/utils/access.js";

const user = (role, extra = {}) => ({ id: "u1", role, cityId: "c1", departmentId: "d1", ...extra });

describe("levels", () => {
  it("numbers the 7 roles 1 to 7 in order", () => {
    expect(ROLES.map(levelOf)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("returns 0 for an unknown role", () => expect(levelOf("root")).toBe(0));
});

describe("hasPermission", () => {
  it("allows a role that holds the permission", () => {
    expect(hasPermission("city_admin", "issue:assign")).toBe(true);
  });
  it("denies a role that does not", () => {
    expect(hasPermission("citizen", "issue:assign")).toBe(false);
    expect(hasPermission("staff", "platform:manage")).toBe(false);
  });
  it("denies an unknown permission or role (deny by default)", () => {
    expect(hasPermission("super_admin", "nothing:here")).toBe(false);
    expect(hasPermission("root", "issue:assign")).toBe(false);
  });
});

describe("inScope", () => {
  it("citizen: only their own records", () => {
    expect(inScope(user("citizen"), { ownerId: "u1" })).toBe(true);
    expect(inScope(user("citizen"), { ownerId: "u2" })).toBe(false);
    expect(inScope(user("citizen"), { cityId: "c1" })).toBe(false);
  });
  it("moderator and city admin: same city", () => {
    expect(inScope(user("city_admin"), { cityId: "c1" })).toBe(true);
    expect(inScope(user("city_admin"), { cityId: "c2" })).toBe(false);
    expect(inScope(user("moderator"), { cityId: "c2" })).toBe(false);
  });
  it("staff and department head: same city and same department", () => {
    expect(inScope(user("staff"), { cityId: "c1", departmentId: "d1" })).toBe(true);
    expect(inScope(user("staff"), { cityId: "c1", departmentId: "d2" })).toBe(false);
    expect(inScope(user("dept_head"), { cityId: "c2", departmentId: "d1" })).toBe(false);
  });
  it("a user with no city never matches a record with no city", () => {
    expect(inScope(user("city_admin", { cityId: null }), { cityId: null })).toBe(false);
    expect(inScope(user("city_admin", { cityId: null }), {})).toBe(false);
  });
  it("super admin: everything; state officer: nothing until states exist", () => {
    expect(inScope(user("super_admin"), { cityId: "zzz" })).toBe(true);
    expect(inScope(user("state_officer"), { cityId: "c1" })).toBe(false);
  });
});

describe("canAssignRole", () => {
  const admin = user("city_admin");
  it("allows a lower level than the actor", () => {
    expect(canAssignRole(admin, { id: "u2", role: "citizen" }, "moderator")).toBe(true);
  });
  it("blocks a level equal to or above the actor's own", () => {
    expect(canAssignRole(admin, { id: "u2", role: "citizen" }, "city_admin")).toBe(false);
    expect(canAssignRole(admin, { id: "u2", role: "citizen" }, "super_admin")).toBe(false);
  });
  it("blocks changing someone at or above the actor's level", () => {
    expect(canAssignRole(admin, { id: "u2", role: "city_admin" }, "citizen")).toBe(false);
    expect(canAssignRole(admin, { id: "u2", role: "super_admin" }, "citizen")).toBe(false);
  });
  it("blocks changing your own role, even downwards", () => {
    expect(canAssignRole(admin, { id: "u1", role: "city_admin" }, "citizen")).toBe(false);
  });
  it("blocks an unknown role", () => {
    expect(canAssignRole(admin, { id: "u2", role: "citizen" }, "root")).toBe(false);
  });
});

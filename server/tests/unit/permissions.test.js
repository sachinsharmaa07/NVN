import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  SCOPE_RULES,
  ROLES,
  can,
  needsMfa,
  levelOf,
  permissionsOf,
} from "../../src/utils/permissions.js";

// A literal copy of the table in docs/phase-1-auth.md section 5: levels that hold the permission,
// then verified, mfa. Changing a permission means changing the doc, this table and the code on purpose.
const DOC_TABLE = {
  "public:read": { levels: [1, 2, 3, 4, 5, 6, 7], verified: false, mfa: false },
  "profile:read_own": { levels: [1, 2, 3, 4, 5, 6, 7], verified: false, mfa: false },
  "profile:update_own": { levels: [1, 2, 3, 4, 5, 6, 7], verified: false, mfa: false },
  "issue:create": { levels: [1, 2, 3, 4, 5], verified: true, mfa: false },
  "issue:read_own": { levels: [1, 2, 3, 4, 5], verified: false, mfa: false },
  "issue:read_scope": { levels: [3, 4, 5, 6, 7], verified: true, mfa: true },
  "issue:assign": { levels: [4, 5], verified: true, mfa: true },
  "issue:update_status": { levels: [3, 4, 5], verified: true, mfa: true },
  "post:create": { levels: [1, 2, 3, 4, 5], verified: true, mfa: false },
  "post:moderate": { levels: [2, 5, 7], verified: true, mfa: true },
  "user:read_scope": { levels: [5, 6, 7], verified: true, mfa: true },
  "user:promote": { levels: [5, 7], verified: true, mfa: true },
  "user:suspend": { levels: [5, 7], verified: true, mfa: true },
  "city:onboard": { levels: [7], verified: true, mfa: true },
  "audit:read": { levels: [5, 7], verified: true, mfa: true },
};

describe("PERMISSIONS matrix", () => {
  it("equals the table in the design doc, permission by permission", () => {
    const actual = Object.fromEntries(
      Object.entries(PERMISSIONS).map(([name, p]) => [
        name,
        { levels: p.roles.map(levelOf).sort((a, b) => a - b), verified: p.verified, mfa: p.mfa },
      ]),
    );
    expect(actual).toEqual(DOC_TABLE);
  });

  it("is frozen so nothing can widen it at run time", () => {
    expect(Object.isFrozen(PERMISSIONS)).toBe(true);
    expect(Object.isFrozen(PERMISSIONS["user:promote"])).toBe(true);
    expect(Object.isFrozen(SCOPE_RULES)).toBe(true);
  });
});

describe("can(role, permission): every role x every permission", () => {
  const cases = ROLES.flatMap((role) =>
    Object.entries(DOC_TABLE).map(([perm, row]) => [
      role,
      perm,
      row.levels.includes(levelOf(role)),
    ]),
  );
  it.each(cases)("%s / %s -> %s", (role, perm, expected) => {
    expect(can(role, perm)).toBe(expected);
  });

  it("denies unknown roles, unknown permissions and prototype keys", () => {
    expect(can("root", "public:read")).toBe(false);
    expect(can(undefined, "public:read")).toBe(false);
    expect(can("super_admin", "nothing:here")).toBe(false);
    expect(can("super_admin", "constructor")).toBe(false);
    expect(can("super_admin", "__proto__")).toBe(false);
  });

  it("keeps state_officer read-only: no create, assign, promote or suspend", () => {
    for (const p of [
      "issue:create",
      "issue:assign",
      "user:promote",
      "user:suspend",
      "post:create",
    ]) {
      expect(can("state_officer", p)).toBe(false);
    }
    expect(can("state_officer", "user:read_scope")).toBe(true);
  });
});

describe("needsMfa(role, permission)", () => {
  const cases = ROLES.flatMap((role) =>
    Object.entries(DOC_TABLE).map(([perm, row]) => [role, perm, row.mfa && levelOf(role) >= 4]),
  );
  it.each(cases)("%s / %s -> %s", (role, perm, expected) => {
    expect(needsMfa(role, perm)).toBe(expected);
  });
  it("is false for unknown permissions and roles", () => {
    expect(needsMfa("super_admin", "nothing:here")).toBe(false);
    expect(needsMfa("root", "user:promote")).toBe(false);
  });
});

describe("SCOPE_RULES", () => {
  it("matches section 6.1 for every role", () => {
    const flat = (r) => [r.cityId, r.departmentId, r.stateCode].join("");
    expect(Object.fromEntries(ROLES.map((r) => [r, flat(SCOPE_RULES[r])]))).toEqual({
      citizen: "FFF",
      moderator: "RFF",
      staff: "RRF",
      dept_head: "RRF",
      city_admin: "RFF",
      state_officer: "FFR",
      super_admin: "FFF",
    });
  });
});

describe("levels and permissionsOf", () => {
  it("numbers the 7 roles 1 to 7 and unknown as 0", () => {
    expect(ROLES.map(levelOf)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(levelOf("root")).toBe(0);
    expect(levelOf(null)).toBe(0);
  });
  it("lists what a role holds", () => {
    expect(permissionsOf("citizen")).toContain("issue:create");
    expect(permissionsOf("citizen")).not.toContain("user:promote");
    expect(permissionsOf("root")).toEqual([]);
  });
});

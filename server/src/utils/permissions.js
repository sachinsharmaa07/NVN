// The permission matrix as data (docs/phase-1-auth.md section 5) and the scope rules (6.1).
// Pure module: no Express, no database. Deny by default: anything not listed is not allowed.

// Roles from lowest to highest. Index + 1 is the level; level 0 (public) is "not signed in".
export const ROLES = Object.freeze([
  "citizen", // 1
  "moderator", // 2, city
  "staff", // 3, department
  "dept_head", // 4, department, MFA
  "city_admin", // 5, city, MFA
  "state_officer", // 6, state, read-only, MFA
  "super_admin", // 7, platform, MFA
]);

/** 1 to 7 for a known role, 0 for anything else (unknown, null, not signed in). */
export const levelOf = (role) => ROLES.indexOf(role) + 1;

/** From this level up a role must have signed in with MFA to use an MFA-flagged permission. */
export const MFA_MIN_LEVEL = 4;

const ALL = ROLES;
const from = (...roles) => roles;

// roles: who holds it | scope: how far it reaches (a label; the service applies it, see access.js)
// verified: verified email needed | mfa: MFA-flagged (enforced only for level >= MFA_MIN_LEVEL).
const entry = (roles, scope, verified, mfa) => Object.freeze({ roles, scope, verified, mfa });

export const PERMISSIONS = Object.freeze({
  "public:read": entry(ALL, "none", false, false),
  "profile:read_own": entry(ALL, "own", false, false),
  "profile:update_own": entry(ALL, "own", false, false),
  "issue:create": entry(
    from("citizen", "moderator", "staff", "dept_head", "city_admin"),
    "own",
    true,
    false,
  ),
  "issue:read_own": entry(
    from("citizen", "moderator", "staff", "dept_head", "city_admin"),
    "own",
    false,
    false,
  ),
  "issue:read_scope": entry(
    from("staff", "dept_head", "city_admin", "state_officer", "super_admin"),
    "scope",
    true,
    true,
  ),
  "issue:assign": entry(from("dept_head", "city_admin"), "scope", true, true),
  "issue:update_status": entry(from("staff", "dept_head", "city_admin"), "scope", true, true),
  "post:create": entry(
    from("citizen", "moderator", "staff", "dept_head", "city_admin"),
    "own",
    true,
    false,
  ),
  "post:moderate": entry(from("moderator", "city_admin", "super_admin"), "scope", true, true),
  "user:read_scope": entry(from("city_admin", "state_officer", "super_admin"), "scope", true, true),
  "user:promote": entry(from("city_admin", "super_admin"), "scope", true, true),
  "user:suspend": entry(from("city_admin", "super_admin"), "scope", true, true),
  "city:onboard": entry(from("super_admin"), "platform", true, true),
  "audit:read": entry(from("city_admin", "super_admin"), "scope", true, true),
});

// Which scope fields each role must (R) or must not (F) carry. One table for Zod, the services and
// the Mongoose hook, so the rule cannot drift between them.
const rule = (cityId, departmentId, stateCode) =>
  Object.freeze({ cityId, departmentId, stateCode });
export const SCOPE_RULES = Object.freeze({
  citizen: rule("F", "F", "F"),
  moderator: rule("R", "F", "F"),
  staff: rule("R", "R", "F"),
  dept_head: rule("R", "R", "F"),
  city_admin: rule("R", "F", "F"),
  state_officer: rule("F", "F", "R"),
  super_admin: rule("F", "F", "F"),
});

/** Does this role hold this permission? Unknown role or permission: false. */
export function can(role, permission) {
  const entryFor = Object.hasOwn(PERMISSIONS, permission) ? PERMISSIONS[permission] : undefined;
  return entryFor ? entryFor.roles.includes(role) : false;
}

/** True when using this permission requires the token's MFA claim for this role (fail closed). */
export function needsMfa(role, permission) {
  const entryFor = Object.hasOwn(PERMISSIONS, permission) ? PERMISSIONS[permission] : undefined;
  return Boolean(entryFor?.mfa) && levelOf(role) >= MFA_MIN_LEVEL;
}

/** All permissions a role holds, for GET /api/me. */
export const permissionsOf = (role) => Object.keys(PERMISSIONS).filter((p) => can(role, p));

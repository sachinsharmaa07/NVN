// Pure access rules (docs/DESIGN.md 7A). No Express, no database: easy to test, easy to read.
// Deny by default: anything not listed here is not allowed.

// Roles from lowest to highest level. The array index + 1 is the level in the DESIGN.md table.
export const ROLES = [
  "citizen", // 1
  "moderator", // 2
  "staff", // 3
  "dept_head", // 4
  "city_admin", // 5
  "state_officer", // 6
  "super_admin", // 7
];

export const levelOf = (role) => ROLES.indexOf(role) + 1; // 0 for an unknown role

// What each role may do. A route names ONE permission; this table says who holds it.
const PERMISSIONS = {
  "issue:create": ["citizen", "moderator"],
  "issue:work": ["staff", "dept_head", "city_admin"],
  "issue:assign": ["dept_head", "city_admin"],
  "post:write": ["citizen", "moderator", "staff", "dept_head", "city_admin"],
  "post:moderate": ["moderator", "city_admin", "super_admin"],
  "city:manage": ["city_admin"],
  "platform:manage": ["super_admin"],
  "oversight:read": ["state_officer", "super_admin"],
};

export function hasPermission(role, permission) {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Is `target` inside the actor's scope? target = { ownerId?, cityId?, departmentId? }.
 * citizen: own records only | moderator, city_admin: their city | staff, dept_head: their department
 * super_admin: everything | state_officer: denied until City has a state (Phase 2), so deny for now.
 */
export function inScope(user, target = {}) {
  switch (user.role) {
    case "super_admin":
      return true;
    case "citizen":
      return sameId(user.id, target.ownerId);
    case "moderator":
    case "city_admin":
      return sameId(user.cityId, target.cityId);
    case "staff":
    case "dept_head":
      return sameId(user.cityId, target.cityId) && sameId(user.departmentId, target.departmentId);
    default:
      return false;
  }
}

/** Nobody can grant a level equal to or above their own, and nobody can change their own level. */
export function canAssignRole(actor, targetUser, newRole) {
  if (levelOf(newRole) === 0 || levelOf(targetUser.role) === 0) return false;
  if (sameId(actor.id, targetUser.id)) return false;
  const actorLevel = levelOf(actor.role);
  return levelOf(newRole) < actorLevel && levelOf(targetUser.role) < actorLevel;
}

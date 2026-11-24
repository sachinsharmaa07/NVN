import { t } from "@/i18n/t";

/*
 * Client copy of the role and permission data (docs/phase-1-auth.md §5, §7.1).
 * DISPLAY ONLY: it decides what to show (menu items, which roles a dialog lists). The server
 * checks every request again, so a wrong or tampered copy here can never grant access.
 */

// Lowest to highest. The index + 1 is the level (citizen 1 ... super_admin 7); public is level 0.
export const ROLES = [
  "citizen",
  "moderator",
  "staff",
  "dept_head",
  "city_admin",
  "state_officer",
  "super_admin",
];

export const levelOf = (role) => ROLES.indexOf(role) + 1; // unknown role -> 0

// Permission -> lowest-to-highest list of roles that hold it (the matrix in §5).
const ALL = ROLES;
export const PERMISSIONS = {
  "public:read": ALL,
  "profile:read_own": ALL,
  "profile:update_own": ALL,
  "issue:create": ROLES.slice(0, 5),
  "issue:read_own": ROLES.slice(0, 5),
  "issue:read_scope": ROLES.slice(2),
  "issue:assign": ["dept_head", "city_admin"],
  "issue:update_status": ["staff", "dept_head", "city_admin"],
  "post:create": ROLES.slice(0, 5),
  "post:moderate": ["moderator", "city_admin", "super_admin"],
  "user:read_scope": ["city_admin", "state_officer", "super_admin"],
  "user:promote": ["city_admin", "super_admin"],
  "user:suspend": ["city_admin", "super_admin"],
  "city:onboard": ["super_admin"],
  "audit:read": ["city_admin", "super_admin"],
};

export const canRole = (role, permission) => PERMISSIONS[permission]?.includes(role) ?? false;

/*
 * Does this user hold the permission? The server sends `permissions[]` on GET /api/me, which is
 * the best source; the matrix above is the fallback (tests, an older server).
 */
export function hasPermission(user, permission) {
  if (!user) return false;
  if (Array.isArray(user.permissions)) return user.permissions.includes(permission);
  return canRole(user.role, permission);
}

// Roles an actor may hand out: strictly below their own level, and only with user:promote.
// (city_admin gets 1-4, super_admin 1-6; super_admin is never assigned through the app.)
export function assignableRoles(actorRole) {
  if (!canRole(actorRole, "user:promote")) return [];
  return ROLES.filter((role) => levelOf(role) < levelOf(actorRole));
}

// Which scope fields a role needs (SCOPE_RULES in §6.1). Everything else must stay empty.
const NEEDS = {
  moderator: { city: true },
  staff: { city: true, department: true },
  dept_head: { city: true, department: true },
  city_admin: { city: true },
  state_officer: { state: true },
};
export const roleNeeds = (role) => ({
  city: false,
  department: false,
  state: false,
  ...NEEDS[role],
});

// Text for the "Area" column and row: department, city, state; super_admin sees everything.
export function areaLabel(user, allLabel) {
  if (user.role === "super_admin") return allLabel;
  const parts = [user.departmentName, user.cityName, user.stateCode].filter(Boolean);
  return parts.length ? parts.join(", ") : "";
}

// "Department head" for "dept_head" (copy keys are camelCase: common.role.deptHead).
export const roleName = (role) =>
  t(`common.role.${String(role).replace(/_(\w)/g, (_, c) => c.toUpperCase())}`);

// Works out the scope fields a new role needs, and checks the city and department are real.
import { City } from "../models/City.js";
import { Department } from "../models/Department.js";
import { AppError } from "../utils/AppError.js";
import { SCOPE_RULES } from "../utils/permissions.js";
import { forbidden, sameId } from "./adminUserSupport.js";

export const SCOPE_FIELDS = ["cityId", "departmentId", "stateCode"];

/** Fields the new role needs, from the body or the target's current values, checked against the actor. */
export async function resolveScope(actor, target, newRole, input) {
  const rule = SCOPE_RULES[newRole];
  const next = {};
  const problems = [];
  for (const f of SCOPE_FIELDS) {
    if (rule[f] === "F") {
      if (input[f] != null) problems.push({ path: f, message: `not allowed for ${newRole}` });
      continue; // stays undefined: the old value is cleared on save
    }
    let value = input[f];
    if (f === "cityId" && actor.role === "city_admin") {
      // The city comes from the actor, never trusted from the body.
      if (value != null && !sameId(value, actor.cityId))
        throw forbidden("You can only manage your own city.");
      value = actor.cityId;
    }
    // Keep a current department only while the user stays in the same city.
    if (value == null && f === "departmentId" && sameId(target.cityId, next.cityId))
      value = target.departmentId;
    if (value == null && f !== "departmentId") value = target[f];
    if (value == null) problems.push({ path: f, message: `required for ${newRole}` });
    else next[f] = String(value);
  }
  if (problems.length === 0) await checkGeo(actor, next, problems);
  if (problems.length > 0) {
    throw new AppError("VALIDATION_ERROR", 400, "Some fields are invalid.", { fields: problems });
  }
  return next;
}

/** City and department must exist and belong together. city_admin mismatches are 403, others 400. */
async function checkGeo(actor, next, problems) {
  if (next.cityId && actor.role !== "city_admin" && !(await City.exists({ _id: next.cityId }))) {
    problems.push({ path: "cityId", message: "unknown city" });
  } else if (
    next.departmentId &&
    !(await Department.exists({ _id: next.departmentId, cityId: next.cityId }))
  ) {
    if (actor.role === "city_admin") throw forbidden("That department is not in your city.");
    problems.push({ path: "departmentId", message: "unknown department for this city" });
  }
}

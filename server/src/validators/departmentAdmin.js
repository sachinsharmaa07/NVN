import { z } from "zod";
import { objectId } from "./adminUsers.js";

// The same rule as Department.code, so a bad code is a 400 here and never a model error.
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_]{2,20}$/, "2 to 20 letters, digits or _");
const name = z.string().trim().min(2).max(100);

export const departmentIdParams = z.object({ id: objectId }).strict();
// cityId: required for a super admin, optional for a city admin (always their own city).
export const createDepartmentBody = z.object({ cityId: objectId.optional(), name, code }).strict();
export const updateDepartmentBody = z.object({ name }).strict();

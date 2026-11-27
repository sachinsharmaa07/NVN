import { z } from "zod";
import { CATEGORIES } from "../utils/categories.js";

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "Not a valid id.");
const hours = z
  .number()
  .int()
  .min(1)
  .max(24 * 90);

export const settingsQuery = z.object({ cityId: objectId.optional() }).strict();
export const categoryParams = z.object({ category: z.enum(CATEGORIES) }).strict();
export const categoryBody = z
  .object({
    cityId: objectId.optional(), // super_admin only; a city admin's own city is used otherwise
    departmentId: objectId.nullable(), // null = the city's triage queue
    respondHours: hours,
    resolveHours: hours,
  })
  .strict();

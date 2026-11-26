import { z } from "zod";
import { objectId } from "./adminUsers.js";
import { INDIA_STATE_CODES } from "../utils/india.js";

export const departmentsQuery = z.object({ cityId: objectId }).strict();

export const citiesQuery = z
  .object({
    stateCode: z.enum(INDIA_STATE_CODES).optional(),
    q: z.string().trim().min(1).max(64).optional(),
    cursor: z.string().max(300).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

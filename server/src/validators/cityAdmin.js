import { z } from "zod";
import { CITY_STATUSES } from "../models/City.js";
import { INDIA_STATE_CODES } from "../utils/india.js";

export const cityIdParams = z.object({ id: z.string().regex(/^[0-9a-f]{24}$/i) }).strict();

export const createCityBody = z
  .object({
    name: z.string().trim().min(2).max(100),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{1,39}$/),
    stateCode: z.enum(INDIA_STATE_CODES),
  })
  .strict();

export const updateCityBody = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    status: z.enum(CITY_STATUSES).optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: "Send name or status." });

import { z } from "zod";
import { PINCODE_RE } from "../utils/india.js";

/** For routes that take no body, params or query: any extra key is a 400. */
export const none = z.object({}).strict();

/** PATCH /api/me: only these three fields can ever change, and at least one must be sent. */
export const patchMeBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    preferredLanguage: z.enum(["en", "hi"]).optional(),
    defaultPincode: z.string().regex(PINCODE_RE).nullable().optional(), // null clears it
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Send at least one field." });

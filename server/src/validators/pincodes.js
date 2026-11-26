import { z } from "zod";
import { PINCODE_RE } from "../utils/india.js";

export const pinParams = z.object({ pin: z.string().regex(PINCODE_RE) }).strict();

// WGS84 degrees. Anywhere on Earth is valid input; a point outside India is simply not inside.
export const checkPointBody = z
  .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
  .strict();

// Shape only; the service answers INVALID_PINCODE (not VALIDATION_ERROR) so the wizard can say so plainly.
export const lookupParams = z.object({ pin: z.string().max(12) }).strict();

export const waitlistBody = z
  .object({ pin: z.string().regex(PINCODE_RE), email: z.email().max(254) })
  .strict();

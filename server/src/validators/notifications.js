import { z } from "zod";

export const listNotificationsQuery = z
  .object({
    cursor: z.string().max(300).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

// Without ids: mark all of mine read.
export const markReadBody = z
  .object({
    ids: z
      .array(z.string().regex(/^[0-9a-f]{24}$/i))
      .min(1)
      .max(50)
      .optional(),
  })
  .strict();

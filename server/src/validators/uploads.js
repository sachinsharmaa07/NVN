import { z } from "zod";

// The shape (our folder, one name segment) is checked in the service, where the env-specific folder is known.
export const discardBody = z
  .object({ publicIds: z.array(z.string().max(200)).min(1).max(3) })
  .strict();

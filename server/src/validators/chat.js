import { z } from "zod";

export const chatBody = z.object({ message: z.string().trim().min(1).max(1000) }).strict();

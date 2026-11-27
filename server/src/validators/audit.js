import { z } from "zod";
import { AUDIT_ACTIONS, AUDIT_TARGETS } from "../models/AuditLog.js";

export const auditQuery = z
  .object({
    action: z.enum(AUDIT_ACTIONS).optional(),
    targetType: z.enum(AUDIT_TARGETS).optional(),
    targetId: z
      .string()
      .regex(/^[0-9a-f]{24}$/i)
      .optional(),
    cursor: z.string().max(300).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

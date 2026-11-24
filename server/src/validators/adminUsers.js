import { z } from "zod";
import { INDIA_STATE_CODES } from "../utils/india.js";
import { ROLES } from "../utils/permissions.js";

export const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "Not a valid id");
const reason = z.string().trim().min(5).max(500);

export const idParams = z.object({ id: objectId }).strict();

// Enums (not free strings) for role and status, so ?role[$ne]=x is a 400 and never reaches a query.
export const listQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(200).optional(),
    q: z.string().trim().min(3).max(64).optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .strict();

// Scope fields are optional here; the service decides which ones the chosen role needs.
export const roleBody = z
  .object({
    role: z.enum(ROLES),
    reason,
    cityId: objectId.optional(),
    departmentId: objectId.optional(),
    stateCode: z.enum(INDIA_STATE_CODES).optional(),
  })
  .strict();

export const statusBody = z.object({ status: z.enum(["active", "suspended"]), reason }).strict();

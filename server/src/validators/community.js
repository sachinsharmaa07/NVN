import { z } from "zod";
import { FLAG_REASONS, FLAG_TARGETS } from "../models/Flag.js";
import { PINCODE_RE } from "../utils/india.js";

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "Not a valid id.");
const page = {
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

export const idParams = z.object({ id: objectId }).strict();

export const feedQuery = z.object({ pincode: z.string().regex(PINCODE_RE), ...page }).strict();
export const pageQuery = z.object(page).strict();

export const createPostBody = z
  .object({
    title: z.string().trim().min(5).max(100),
    body: z.string().trim().min(10).max(2000),
  })
  .strict();

export const createCommentBody = z
  .object({
    body: z.string().trim().min(1).max(1000),
    parentId: objectId.optional(),
  })
  .strict();

export const flagBody = z
  .object({
    targetType: z.enum(FLAG_TARGETS),
    targetId: objectId,
    reason: z.enum(FLAG_REASONS),
  })
  .strict();

export const queueQuery = z
  .object({
    type: z.enum(FLAG_TARGETS).default("post"),
    status: z.enum(["hidden", "published"]).default("hidden"),
    ...page,
  })
  .strict();

export const moderateParams = z.object({ type: z.enum(FLAG_TARGETS), id: objectId }).strict();

export const moderateBody = z
  .object({
    action: z.enum(["hide", "restore", "delete"]),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

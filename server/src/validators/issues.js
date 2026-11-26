import { z } from "zod";
import { CATEGORIES } from "../utils/categories.js";
import { PINCODE_RE } from "../utils/india.js";
import { MAX_PHOTOS, TICKET_RE } from "../models/Issue.js";
import { checkPointBody } from "./pincodes.js";

// POST /api/issues. Photos are Cloudinary public_ids; photoCheckService decides whether they're ours.
export const createIssueBody = checkPointBody
  .extend({
    pincode: z.string().regex(PINCODE_RE),
    category: z.enum(CATEGORIES),
    title: z.string().trim().min(5).max(100),
    description: z.string().trim().min(20).max(1000),
    photos: z.array(z.string().max(200)).max(MAX_PHOTOS).default([]),
  })
  .strict();

// One key per draft, made by the browser with crypto.randomUUID().
export const idempotencyKey = z.uuid();

export const ticketParams = z.object({ ticketId: z.string().regex(TICKET_RE) }).strict();

const page = {
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

// GET /api/issues/mine
export const mineQuery = z.object(page).strict();

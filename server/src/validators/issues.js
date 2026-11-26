import { z } from "zod";
import { CATEGORIES } from "../utils/categories.js";
import { PINCODE_RE } from "../utils/india.js";
import { ISSUE_STATUSES, MAX_PHOTOS, NOTE_MAX, SLA_STATES, TICKET_RE } from "../models/Issue.js";
import { QUEUES } from "../models/CategoryMapping.js";
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

// GET /api/staff/issues
export const staffQueueQuery = z
  .object({
    ...page,
    status: z.enum(ISSUE_STATUSES).optional(),
    sla: z.enum(SLA_STATES).optional(),
    category: z.enum(CATEGORIES).optional(),
    queue: z.enum(QUEUES).optional(),
  })
  .strict();

// M2 writes. `version` is the issue's version the client last read (optimistic concurrency, 409 on mismatch).
const version = z.number().int().min(0);
const note = z.string().trim().min(3).max(NOTE_MAX);

export const statusBody = z
  .object({
    status: z.enum(ISSUE_STATUSES),
    note: note.optional(),
    afterPhotoPublicIds: z.array(z.string().max(200)).min(1).max(MAX_PHOTOS).optional(),
    version,
  })
  .strict();
export const assignBody = z
  .object({ departmentId: z.string().regex(/^[0-9a-f]{24}$/i), version })
  .strict();
export const versionBody = z.object({ version }).strict(); // confirm, resume
export const reopenBody = z.object({ note, version }).strict();
export const holdBody = z.object({ reason: note, version }).strict();

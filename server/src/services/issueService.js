// POST /api/issues and GET /api/issues/:ticketId (M1 step 8). Checks run before the transaction (they only
// read, or call Cloudinary); the transaction holds exactly the writes that must commit together.
import mongoose from "mongoose";
import { Issue } from "../models/Issue.js";
import { CategoryMapping } from "../models/CategoryMapping.js";
import { Department } from "../models/Department.js";
import { SlaPolicy } from "../models/SlaPolicy.js";
import { AppError } from "../utils/AppError.js";
import { DEFAULT_SLA_HOURS } from "../utils/categories.js";
import { clock } from "../utils/clock.js";
import { expectedBy } from "../utils/expectedBy.js";
import { record } from "./auditService.js";
import { inTransaction } from "./adminUserSupport.js";
import { locatePoint, servedPincode } from "./pincodeService.js";
import { verifyPhotos } from "./photoCheckService.js";
import { nextTicketId } from "./ticketService.js";

const notFound = () => new AppError("NOT_FOUND", 404, "We couldn't find that.");

/** What the reporter sees: the counterfoil now, the tracking page later. Fields picked one by one. */
async function view(issue) {
  const dept = issue.departmentId
    ? await Department.findById(issue.departmentId, "name").lean()
    : null;
  return {
    ticketId: issue.ticketId,
    status: issue.status,
    category: issue.category,
    title: issue.title,
    pincode: issue.pincode,
    precision: issue.precision,
    queue: issue.queue,
    department: dept ? { id: String(dept._id), name: dept.name } : null,
    expectedBy: issue.expectedBy,
    createdAt: issue.createdAt,
  };
}

/** Decision 2 and M1-6: the city's mapping; no mapping (or "other") goes to the city triage queue. */
async function route(cityId, category, session) {
  const m = await CategoryMapping.findOne({ cityId, category }, "departmentId queue")
    .session(session)
    .lean();
  if (!m || category === "other" || !m.departmentId) return { departmentId: null, queue: "triage" };
  return { departmentId: m.departmentId, queue: "department" };
}

/** Decision 3: the city's policy wins over the national default (cityId null); the seed is the fallback. */
async function resolveHours(cityId, category, session) {
  const rows = await SlaPolicy.find(
    { category, cityId: mongoose.trusted({ $in: [cityId, null] }) },
    "cityId resolveHours",
  )
    .session(session)
    .lean();
  const policy = rows.find((r) => r.cityId) ?? rows[0];
  return policy?.resolveHours ?? DEFAULT_SLA_HOURS[category].resolveHours;
}

const findByKey = (reporterId, key) => Issue.findOne({ reporterId, idempotencyKey: key }).lean();

/**
 * @param actor  req.user ({ id, role })
 * @param input  the Zod-checked body
 * @param key    the Idempotency-Key (UUID)
 * @param ctx    { ip, requestId }
 * @returns {{ created: boolean, issue: object }} created false = a replay of the same key
 */
export async function createIssue(actor, input, key, ctx = {}) {
  const first = await findByKey(actor.id, key);
  if (first) return { created: false, issue: await view(first) };

  const pincode = await servedPincode(input.pincode);
  const point = { lat: input.lat, lng: input.lng };
  const { inside, precision } = await locatePoint(pincode, point);
  if (!inside) {
    throw new AppError("OUTSIDE_PINCODE", 422, `That spot is outside pincode ${input.pincode}.`);
  }
  const photos = input.photos.length ? await verifyPhotos(input.photos) : [];

  const write = () =>
    inTransaction(async (session) => {
      const now = clock.now();
      const { departmentId, queue } = await route(pincode.cityId, input.category, session);
      const hours = await resolveHours(pincode.cityId, input.category, session);
      const [issue] = await Issue.create(
        [
          {
            ticketId: await nextTicketId(now, { session }),
            reporterId: actor.id,
            cityId: pincode.cityId,
            pincode: input.pincode,
            location: { type: "Point", coordinates: [input.lng, input.lat] },
            precision,
            category: input.category,
            departmentId,
            queue,
            title: input.title,
            description: input.description,
            photos,
            status: "submitted",
            statusHistory: [{ status: "submitted", at: now, by: actor.id }],
            expectedBy: expectedBy(now, hours),
            idempotencyKey: key,
          },
        ],
        { session },
      );
      await record(
        {
          actorType: "user",
          actorId: actor.id,
          actorRole: actor.role,
          action: "issue.created",
          targetId: issue._id,
          cityId: pincode.cityId,
          after: { ticketId: issue.ticketId, category: issue.category, queue, departmentId },
          ip: ctx.ip,
          requestId: ctx.requestId,
        },
        { session },
      );
      return issue.toObject();
    });

  try {
    return { created: true, issue: await view(await write()) };
  } catch (err) {
    if (err?.code !== 11000) throw err;
    // Same key sent twice at once: the loser of the unique index returns the winner's issue.
    const winner = await findByKey(actor.id, key);
    if (winner) return { created: false, issue: await view(winner) };
    // Otherwise the first-of-the-year counter upsert raced (ticketService): one fresh try finds the row.
    return { created: true, issue: await view(await write()) };
  }
}

/** The reporter's own issue. Someone else's, or a ticket that doesn't exist, is the same 404. */
export async function getOwnIssue(actor, ticketId) {
  const issue = await Issue.findOne({ ticketId, reporterId: actor.id }).lean();
  if (!issue) throw notFound();
  return view(issue);
}

// GET /api/admin/users: the scoped, searchable, cursor-paginated list.
import { logger } from "../config/logger.js";
import { City } from "../models/City.js";
import { User } from "../models/User.js";
import { decodeCursor, pageOf } from "../utils/cursor.js";
import { lookupGeoNames } from "./geoNames.js";
import { forbidden, serializeAdminUser, trusted } from "./adminUserSupport.js";

const log = logger.child({ component: "adminUserList" });
const LIST_FIELDS =
  "email name avatarUrl role cityId departmentId stateCode status suspendedReason emailVerified lastLoginAt createdAt";
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Rows the actor may see in the list. trusted() keeps our own $in from being neutralised. */
async function listScope(actor) {
  if (actor.role === "super_admin") return {};
  if (actor.role === "city_admin" && actor.cityId) return { cityId: actor.cityId };
  if (actor.role === "state_officer" && actor.stateCode) {
    const cityIds = await City.find({ stateCode: actor.stateCode }).distinct("_id");
    return { $or: [{ stateCode: actor.stateCode }, { cityId: trusted({ $in: cityIds }) }] };
  }
  throw forbidden();
}

/** GET /api/admin/users. Cursor pagination on (createdAt, _id), one extra row to detect a next page. */
export async function listUsers(actor, query, ctx = {}) {
  const { limit = 20, cursor, q, role, status } = query;
  const text = q?.toLowerCase();
  const exactEmail = Boolean(text?.includes("@"));
  let scope = await listScope(actor);
  // Q3: a city_admin finds a citizen (who has no city) only by typing the exact full email.
  if (exactEmail && actor.role === "city_admin") {
    scope = { $or: [{ cityId: actor.cityId }, { role: "citizen" }] };
  }
  const clauses = [scope];
  if (exactEmail) clauses.push({ email: text });
  else if (text) {
    // Anchored, escaped prefix: never a regex built from raw input (ReDoS) and index-friendly for email.
    const prefix = `^${escapeRegex(text)}`;
    clauses.push({
      $or: [
        { email: trusted({ $regex: prefix }) },
        { name: trusted({ $regex: prefix, $options: "i" }) },
      ],
    });
  }
  if (role) clauses.push({ role });
  if (status) clauses.push({ status });
  if (cursor) {
    const c = decodeCursor(cursor);
    clauses.push({
      $or: [
        { createdAt: trusted({ $lt: c.createdAt }) },
        { createdAt: c.createdAt, _id: trusted({ $lt: c._id }) },
      ],
    });
  }
  const rows = await User.find({ $and: clauses })
    .select(LIST_FIELDS)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const { items, nextCursor } = pageOf(rows, limit);
  if (q) {
    // Length only, never the text: queries can contain emails.
    (ctx.log ?? log).info({
      event: "admin.search",
      actorId: actor.id,
      queryLength: q.length,
      count: items.length,
    });
  }
  const names = await lookupGeoNames(items); // one batched lookup for the page, not one per row
  return { items: items.map((u) => serializeAdminUser(u, actor, names)), nextCursor };
}

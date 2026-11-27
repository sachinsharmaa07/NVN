// POST /api/chat (DESIGN.md 5). Ticket questions are answered from the database, never by the model, so a
// status is always right. Nothing is stored. Another person's ticket and a missing one answer the same.
import { Issue } from "../models/Issue.js";
import { can } from "../utils/permissions.js";
import { asksForOwnList, extractTicketIds, redact } from "../utils/chatText.js";
import { askGemini } from "./geminiService.js";
import { lookupGeoNames } from "./geoNames.js";
import { issueScope } from "./issueQueryService.js";
import { trusted } from "./adminUserSupport.js";

const FIELDS = {
  ticketId: 1,
  title: 1,
  status: 1,
  expectedBy: 1,
  updatedAt: 1,
  departmentId: 1,
  cityId: 1,
};

/** Reporter's own, or (for staff and above) anything in their scope. */
async function visibleFilter(actor) {
  const own = { reporterId: actor.id };
  if (!can(actor.role, "issue:read_scope")) return own;
  return { $or: [own, await issueScope(actor, { triage: true })] };
}

async function ticketCards(rows) {
  const names = await lookupGeoNames(rows);
  return rows.map((r) => ({
    ticketId: r.ticketId,
    title: r.title,
    status: r.status,
    expectedBy: r.expectedBy,
    updatedAt: r.updatedAt,
    department: names.department(r.departmentId) ?? null,
  }));
}

/**
 * @returns {{ kind: "ticket", tickets, unknown } | { kind: "list", tickets } | { kind: "general", reply }
 *           | { kind: "fallback" }}
 */
export async function answer(actor, { message }, log) {
  const ids = extractTicketIds(message);
  if (ids.length) {
    const rows = await Issue.find(
      { ticketId: trusted({ $in: ids }), ...(await visibleFilter(actor)) },
      FIELDS,
    ).lean();
    const found = new Set(rows.map((r) => r.ticketId));
    return {
      kind: "ticket",
      tickets: await ticketCards(rows),
      unknown: ids.filter((id) => !found.has(id)),
    };
  }
  if (asksForOwnList(message)) {
    const rows = await Issue.find({ reporterId: actor.id }, FIELDS)
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    return { kind: "list", tickets: await ticketCards(rows) };
  }
  const reply = await askGemini(redact(message), log);
  return reply ? { kind: "general", reply } : { kind: "fallback" };
}

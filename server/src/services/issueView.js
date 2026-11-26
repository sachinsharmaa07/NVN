// What the API shows of an issue. Fields picked one by one: never reporterId, actor ids or emails.
import { Department } from "../models/Department.js";

const photos = (list = []) =>
  list.map(({ publicId, width, height }) => ({ publicId, width, height }));

/** List row for "my issues". `version` is what a write must send back (optimistic concurrency). */
export const summary = (issue) => ({
  ticketId: issue.ticketId,
  status: issue.status,
  category: issue.category,
  title: issue.title,
  pincode: issue.pincode,
  queue: issue.queue,
  expectedBy: issue.expectedBy,
  slaState: issue.slaState ?? "on_track",
  onHold: issue.slaPausedAt != null,
  version: issue.__v ?? 0,
  createdAt: issue.createdAt,
});

/** Staff queue row: what staff need to find and fix it, still without the reporter's identity. */
export const staffItem = (issue) => ({
  ...summary(issue),
  description: issue.description,
  departmentId: issue.departmentId ? String(issue.departmentId) : null,
  location: { lat: issue.location.coordinates[1], lng: issue.location.coordinates[0] },
  photos: photos(issue.photos),
  afterPhotos: photos(issue.afterPhotos),
  holdReason: issue.holdReason ?? null,
});

/** Status history with the actor's role only (M1 rows have no role: null). */
const timeline = (history = []) =>
  history.map((h) => ({ status: h.status, at: h.at, role: h.role ?? null, note: h.note ?? null }));

/** The reporter's tracking page (and every write's answer). */
export async function detail(issue) {
  const dept = issue.departmentId
    ? await Department.findById(issue.departmentId, "name").lean()
    : null;
  return {
    ...summary(issue),
    precision: issue.precision,
    department: dept ? { id: String(dept._id), name: dept.name } : null,
    afterPhotos: photos(issue.afterPhotos),
    holdReason: issue.holdReason ?? null,
    timeline: timeline(issue.statusHistory),
  };
}

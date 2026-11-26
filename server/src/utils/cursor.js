// Opaque cursor for keyset pagination on (createdAt desc, _id desc). Clients treat it as a string.
import { AppError } from "./AppError.js";

const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;
const bad = () => new AppError("VALIDATION_ERROR", 400, "That page cursor is not valid.");

/** { createdAt: Date, _id } -> base64url string. */
export function encodeCursor({ createdAt, _id }) {
  const payload = { t: new Date(createdAt).getTime(), i: String(_id) };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/** string -> { createdAt: Date, _id: string }. Throws 400 VALIDATION_ERROR for anything malformed. */
export function decodeCursor(text) {
  if (typeof text !== "string" || text.length === 0 || text.length > 200) throw bad();
  let payload;
  try {
    payload = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    throw bad();
  }
  const t = payload?.t;
  if (!Number.isSafeInteger(t) || typeof payload?.i !== "string" || !OBJECT_ID_RE.test(payload.i)) {
    throw bad();
  }
  const createdAt = new Date(t);
  if (Number.isNaN(createdAt.getTime())) throw bad(); // a safe integer can still be out of Date range
  return { createdAt, _id: payload.i };
}

/** Mongo filter for "rows after this cursor" in (createdAt desc, _id desc) order. */
export const cursorFilter = ({ createdAt, _id }) => ({
  $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: _id } }],
});

/**
 * Fetch limit + 1 rows, pass them here: returns the page and the cursor of its last row (or null).
 * The extra row only proves there is a next page; it is dropped.
 */
export function pageOf(rows, limit) {
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? encodeCursor(items[items.length - 1]) : null;
  return { items, nextCursor };
}

/** Name-ordered lists (name asc, _id asc): { name, _id } -> opaque string, and back. */
export const encodeNameCursor = ({ name, _id }) =>
  Buffer.from(JSON.stringify({ n: name, i: String(_id) })).toString("base64url");

export function decodeNameCursor(text) {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    throw bad();
  }
  if (
    typeof payload?.n !== "string" ||
    typeof payload?.i !== "string" ||
    !OBJECT_ID_RE.test(payload.i)
  ) {
    throw bad();
  }
  return { name: payload.n, _id: payload.i };
}

/** Staff queue order (expectedBy asc, createdAt asc, _id asc): row -> opaque string, and back. */
export const encodeQueueCursor = ({ expectedBy, createdAt, _id }) =>
  Buffer.from(
    JSON.stringify({
      e: new Date(expectedBy).getTime(),
      t: new Date(createdAt).getTime(),
      i: String(_id),
    }),
  ).toString("base64url");

export function decodeQueueCursor(text) {
  let p;
  try {
    p = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    throw bad();
  }
  const dateOf = (ms) => (Number.isSafeInteger(ms) ? new Date(ms) : new Date(NaN));
  const expectedBy = dateOf(p?.e);
  const createdAt = dateOf(p?.t);
  if (
    Number.isNaN(expectedBy.getTime()) ||
    Number.isNaN(createdAt.getTime()) ||
    typeof p?.i !== "string" ||
    !OBJECT_ID_RE.test(p.i)
  ) {
    throw bad();
  }
  return { expectedBy, createdAt, _id: p.i };
}

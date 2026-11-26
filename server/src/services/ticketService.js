// Ticket IDs, decision M1-1: NIV-YYYY-NNNNNN, a counter per year. One atomic $inc per ticket, so
// parallel submits never share a number and never skip one (a failed submit after this call does).
import { Counter } from "../models/Counter.js";
import { clock } from "../utils/clock.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The year as a resident in India sees it (an issue at 00:30 IST on 1 Jan is next year's). */
const istYear = (date) => new Date(date.getTime() + IST_OFFSET_MS).getUTCFullYear();

async function bump(id, session) {
  const row = await Counter.findOneAndUpdate(
    { _id: id },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", lean: true, session },
  );
  return row.seq;
}

/**
 * Next ticket ID for a submit happening at `now`. Pass `session` to take the number inside the issue
 * transaction: an aborted submit then gives its number back, so the sequence has no gaps.
 */
export async function nextTicketId(now = clock.now(), { session } = {}) {
  const year = istYear(now);
  const id = `ticket:${year}`;
  let seq;
  try {
    seq = await bump(id, session);
  } catch (err) {
    // Two first-of-the-year upserts can race on _id; the loser retries once and finds the row.
    // Inside a transaction the error has aborted it, so the caller retries the whole transaction.
    if (err?.code !== 11000 || session) throw err;
    seq = await bump(id);
  }
  return `NIV-${year}-${String(seq).padStart(6, "0")}`;
}

// Pure text helpers for the help chat (DESIGN.md 5).
const TICKET_IN_TEXT = /\bNIV-(\d{4})-(\d{6})\b/gi;

/** Ticket ids in a message, upper-cased, without repeats, at most 3 (so a paste of hundreds does nothing). */
export function extractTicketIds(text) {
  const ids = [...text.matchAll(TICKET_IN_TEXT)].map((m) => `NIV-${m[1]}-${m[2]}`);
  return [...new Set(ids)].slice(0, 3);
}

// "my complaints", "status of my report", "मेरी शिकायत": the asker wants their own list, not general help.
const MINE_RE = /\b(my|mine)\b.*\b(complaints?|issues?|reports?|tickets?|status)\b|मेरी\s+शिकायत/i;
export const asksForOwnList = (text) => MINE_RE.test(text);

// Never send contact details to the model: emails and Indian phone numbers become placeholders.
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE_RE = /(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g;
export const redact = (text) => text.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");

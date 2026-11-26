// Dates show as "26 Nov 2026" in India time (CLAUDE.md: store UTC, show IST).
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function formatDate(value) {
  return value ? dateFormat.format(new Date(value)) : "";
}

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});
const partsOf = (date) =>
  Object.fromEntries(dateTimeFormat.formatToParts(date).map((p) => [p.type, p.value]));

/** "29 Nov, 5:00 PM" in IST (UI.md §8); the year only when it isn't the current IST year. */
export function formatDateTime(value, now = new Date()) {
  if (!value) return "";
  const p = partsOf(new Date(value));
  const year = p.year === partsOf(now).year ? "" : ` ${p.year}`;
  return `${p.day} ${p.month}${year}, ${p.hour}:${p.minute} ${p.dayPeriod.toUpperCase()}`;
}

// "Asha Rao" -> "AR"; one word -> first letter; no name -> first letter of the email.
export function initialsOf(user) {
  const source = (user?.name || user?.email || "").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0];
  return letters.toUpperCase();
}

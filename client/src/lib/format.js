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

// "Asha Rao" -> "AR"; one word -> first letter; no name -> first letter of the email.
export function initialsOf(user) {
  const source = (user?.name || user?.email || "").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0];
  return letters.toUpperCase();
}

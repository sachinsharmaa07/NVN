import { t } from "@/i18n/t";

// at_risk starts when 75% of the time allowed has been used (CLAUDE.md enums, UI.md §2.1).
export const AT_RISK_PCT = 75;

const MINUTE = 60 * 1000;

/**
 * Pure SLA maths, no React. Dates may be Date objects or ISO strings.
 * getSlaState({ startAt, dueAt, now }) -> { state, usedPct, msLeft }
 *   state:   "on_track" (< 75% used), "at_risk" (>= 75%), "breached" (now is past dueAt)
 *   usedPct: share of the allowed time already used, 0 and up (over 100 once overdue)
 *   msLeft:  milliseconds until dueAt; negative once overdue
 */
export function getSlaState({ startAt, dueAt, now = new Date() }) {
  const start = new Date(startAt).getTime();
  const due = new Date(dueAt).getTime();
  const current = new Date(now).getTime();

  const total = due - start;
  const msLeft = due - current;
  // A zero-length window counts as fully used, which avoids dividing by zero.
  const usedPct = total > 0 ? Math.max(0, ((current - start) / total) * 100) : 100;

  let state = "on_track";
  if (msLeft < 0) state = "breached";
  else if (usedPct >= AT_RISK_PCT) state = "at_risk";

  return { state, usedPct, msLeft };
}

// "1 day" / "3 days", "1 hr" / "4 hrs", "1 min" / "20 min", all from i18n.
function unit(count, one, many) {
  return count === 1 ? t(one) : t(many, { count });
}

/**
 * Turns a duration into short plain text with at most two units:
 * "2 days 4 hrs", "3 hrs 20 min", "45 min", or "less than a minute".
 * The sign is ignored; callers decide between "left" and "Overdue by".
 */
export function formatDuration(ms) {
  const totalMin = Math.floor(Math.abs(ms) / MINUTE);
  if (totalMin < 1) return t("system.sla.lessThanMinute");

  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;

  const d = unit(days, "system.sla.day", "system.sla.days");
  const h = unit(hours, "system.sla.hour", "system.sla.hours");
  const m = unit(mins, "system.sla.minute", "system.sla.minutes");

  if (days > 0) return hours > 0 ? t("system.sla.twoUnits", { first: d, second: h }) : d;
  if (hours > 0) return mins > 0 ? t("system.sla.twoUnits", { first: h, second: m }) : h;
  return m;
}

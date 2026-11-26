import { CATEGORIES } from "@/components/report/categories";
import { t } from "@/i18n/t";

// Client copy of server/src/utils/issueStateMachine.js, DISPLAY ONLY: it decides which buttons to offer.
// The server checks every transition again (400 INVALID_TRANSITION / 403), so a stale copy can't grant anything.
const WORKERS = ["staff", "dept_head", "city_admin"];
const LEADS = ["dept_head", "city_admin"];

const TRANSITIONS = {
  submitted: { assigned: WORKERS, rejected: LEADS },
  assigned: { in_progress: WORKERS },
  in_progress: { resolved: WORKERS },
  reopened: { assigned: WORKERS },
};

export const OPEN_STATUSES = ["submitted", "assigned", "in_progress", "reopened"];

/**
 * Statuses this role may move the issue to through PATCH .../status. A triage issue (no department)
 * goes to `assigned` only through Assign, and nothing moves while on hold.
 */
export function nextStatuses(issue, role) {
  if (issue.onHold) return [];
  return Object.entries(TRANSITIONS[issue.status] ?? {})
    .filter(([to, roles]) => roles.includes(role) && !(to === "assigned" && !issue.departmentId))
    .map(([to]) => to);
}

export const NOTE_MIN = 3; // server: note 3 to 500
export const REOPEN_MIN = 10;

export const categoryLabel = (value) =>
  t(CATEGORIES.find((c) => c.value === value)?.label ?? value);

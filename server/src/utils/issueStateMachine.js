// Issue lifecycle (decision M1-2, ARCHITECTURE 12.3). Pure: every legal edge and who may take it.
// "reporter" is the issue's own reporter (any role); "system" is the SLA job's auto-close.
const WORKERS = Object.freeze(["staff", "dept_head", "city_admin"]);
const LEADS = Object.freeze(["dept_head", "city_admin"]);

export const TRANSITIONS = Object.freeze({
  submitted: Object.freeze({ assigned: WORKERS, rejected: LEADS }),
  assigned: Object.freeze({ in_progress: WORKERS }),
  in_progress: Object.freeze({ resolved: WORKERS }),
  resolved: Object.freeze({
    closed: Object.freeze(["reporter", "system"]),
    reopened: Object.freeze(["reporter"]),
  }),
  reopened: Object.freeze({ assigned: WORKERS }),
  closed: Object.freeze({}),
  rejected: Object.freeze({}),
});

// The SLA clock runs only in these; resolved stops it, closed and rejected end it.
export const OPEN_STATUSES = Object.freeze(["submitted", "assigned", "in_progress", "reopened"]);

/**
 * @param from  current status
 * @param to    wanted status
 * @param actor a role, "reporter" or "system"
 * @returns {"ok" | "invalid" | "forbidden"} invalid: no such edge; forbidden: the edge exists, not for you
 */
export function checkTransition(from, to, actor) {
  const edges = Object.hasOwn(TRANSITIONS, from) ? TRANSITIONS[from] : undefined;
  const who = edges && Object.hasOwn(edges, to) ? edges[to] : undefined;
  if (!who) return "invalid";
  return who.includes(actor) ? "ok" : "forbidden";
}

/** A note is required to reject (tells the resident why) and to reopen (tells staff why). */
export const needsNote = (to) => to === "rejected" || to === "reopened";

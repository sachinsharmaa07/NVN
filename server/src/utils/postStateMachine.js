// Community moderation (DESIGN.md 6, ARCHITECTURE 12.5). Pure: every legal edge for posts and comments and who
// may take it. "author" owns the content, "moderator" holds post:moderate in scope, "system" is the flag count.
export const CONTENT_STATUSES = Object.freeze(["published", "hidden", "deleted"]);

// The flag count that hides content until a moderator looks at it (decision 7: "about 3").
export const AUTO_HIDE_FLAGS = 3;

const TRANSITIONS = Object.freeze({
  published: Object.freeze({
    hidden: Object.freeze(["moderator", "system"]),
    deleted: Object.freeze(["author", "moderator"]),
  }),
  hidden: Object.freeze({
    published: Object.freeze(["moderator"]),
    deleted: Object.freeze(["author", "moderator"]),
  }),
  deleted: Object.freeze({}),
});

/** @returns {"ok" | "invalid" | "forbidden"} invalid: no such edge; forbidden: the edge exists, not for you */
export function checkContentTransition(from, to, actor) {
  const edges = Object.hasOwn(TRANSITIONS, from) ? TRANSITIONS[from] : undefined;
  const who = edges && Object.hasOwn(edges, to) ? edges[to] : undefined;
  if (!who) return "invalid";
  return who.includes(actor) ? "ok" : "forbidden";
}

/** A moderator must say why they hid or deleted something; the author and the system need not. */
export const needsReason = (to, actor) => actor === "moderator" && to !== "published";

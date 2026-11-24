// A small in-process circuit breaker (one server instance, ADR 0001).
// closed -> (threshold consecutive failures) -> open for openMs -> half_open: one probe call decides.
export function createBreaker({ threshold = 5, openMs = 15_000, now = Date.now } = {}) {
  let failures = 0;
  let openedAt = null;
  let probing = false;
  const state = () => {
    if (openedAt === null) return "closed";
    return now() - openedAt < openMs ? "open" : "half_open";
  };
  return {
    state,
    /** May this call go ahead? In half_open exactly one caller (the probe) gets true. */
    acquire() {
      const s = state();
      if (s === "closed") return true;
      if (s === "open" || probing) return false;
      probing = true;
      return true;
    },
    /** The upstream answered (even with a 4xx): it is reachable, so reset. */
    success() {
      failures = 0;
      openedAt = null;
      probing = false;
    },
    /** Network, timeout, 5xx or exhausted 429. A failed probe re-opens at once. */
    failure() {
      failures += 1;
      probing = false;
      if (failures >= threshold || openedAt !== null) openedAt = now();
    },
  };
}

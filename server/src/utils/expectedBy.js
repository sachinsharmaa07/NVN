// Pure SLA date maths (decision 3): calendar hours from submission, pushed back by time spent on hold.
const HOUR_MS = 60 * 60 * 1000;

/**
 * @param {Date} submittedAt when the issue was submitted (or reopened: a fresh deadline)
 * @param {number} hours     the policy's resolveHours (or respondHours)
 * @param {number} [pausedMs] total time the issue sat on hold (slaPausedAt), 0 by default
 * @returns {Date} the deadline
 */
export function expectedBy(submittedAt, hours, pausedMs = 0) {
  const start = submittedAt instanceof Date ? submittedAt.getTime() : NaN;
  if (Number.isNaN(start)) throw new TypeError("submittedAt must be a valid Date");
  if (!(hours > 0) || !Number.isFinite(hours))
    throw new TypeError("hours must be a positive number");
  if (!(pausedMs >= 0) || !Number.isFinite(pausedMs)) throw new TypeError("pausedMs must be >= 0");
  return new Date(start + hours * HOUR_MS + pausedMs);
}

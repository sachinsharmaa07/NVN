// SLA job timer. The work is services/slaJobService.js (runSlaTick, exported for direct calls).
// One server instance runs it (ADR 0001). Off in tests and when SLA_JOB_INTERVAL_MS is 0.
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { runSlaTick } from "../services/slaJobService.js";

export { runSlaTick };

/** Starts the timer; returns a stop function (or null when off). unref(): never keeps the process alive. */
export function startSlaJob(intervalMs = config.SLA_JOB_INTERVAL_MS) {
  if (config.NODE_ENV === "test" || !intervalMs) return null;
  let running = false; // a slow tick is never overlapped by the next one
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runSlaTick();
    } catch (err) {
      logger.error({ event: "sla.tick_failed", err }, "SLA tick failed");
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

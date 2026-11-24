import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/t";
import { SlaBadge } from "./SlaBadge";
import { formatDuration, getSlaState } from "./slaState";

const ONE_MINUTE = 60 * 1000;

/**
 * Time left on an issue's SLA clock: a badge (On track / At risk / Overdue / Paused) and plain text
 * ("2 days 4 hrs left", "Overdue by 3 hrs").
 *
 * - `now` fixes the clock (tests, style guide). Without it the text refreshes once a minute.
 * - `pausedAt` freezes the clock at that moment (the issue is on hold).
 * - Only the badge is an aria-live region, so screen readers hear the state change ("At risk")
 *   once, not every minute's new number (WCAG 2.2.2, UI.md §9).
 * Pure maths lives in slaState.js: import getSlaState from there.
 */
export function SlaCountdown({ startAt, dueAt, now, pausedAt, className }) {
  const live = now === undefined && !pausedAt;
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => setTick(Date.now()), ONE_MINUTE);
    return () => clearInterval(id);
  }, [live]);

  // A paused clock is measured at the moment it was paused.
  const at = pausedAt ? new Date(pausedAt) : (now ?? new Date(tick));
  const { state, msLeft } = getSlaState({ startAt, dueAt, now: at });
  const time = formatDuration(msLeft);

  const overdue = state === "breached";
  const badgeState = pausedAt && !overdue ? "paused" : state;
  let text = t("system.sla.timeLeft", { time });
  if (overdue) text = t("system.sla.overdueBy", { time });
  else if (pausedAt) text = t("system.sla.pausedWith", { time });

  return (
    <div
      data-slot="sla-countdown"
      data-state={badgeState}
      className={cn("inline-flex flex-wrap items-center gap-2", className)}
    >
      <span aria-live="polite" aria-atomic="true">
        <SlaBadge state={badgeState} />
      </span>
      <span
        className={cn(
          "text-sm tabular-nums",
          overdue ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {text}
      </span>
    </div>
  );
}

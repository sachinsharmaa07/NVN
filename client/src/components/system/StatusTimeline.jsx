import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/t";
import { stagger } from "@/lib/motion";
import { durations, easings } from "./motionTokens";
import { STATUS_META } from "./statusMeta";

// Reveal: steps fade and rise 8px 30ms apart (max 8 staggered, UI.md §4.2); each connector then draws down.
// Every single animation is at most 320ms (the `slow` token); only the stagger adds up.
const listVariants = stagger(0.03, 8);
const stepVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.base, ease: easings.enter } },
};
const lineVariants = {
  hidden: { scaleY: 0 },
  visible: {
    scaleY: 1,
    transition: { duration: durations.slow, ease: easings.standard, delay: durations.fast },
  },
};

/**
 * Vertical status history for an issue, oldest at the top (UI.md §7).
 * steps: [{ status, label?, at?, note?, state: "done" | "current" | "upcoming" }]
 * The current step carries aria-current="step". With `animate` (default) the steps draw once on mount
 * (no in-view trigger, UI.md §4.2); with reduced motion or animate={false} everything is there at once.
 */
export function StatusTimeline({ steps, animate = true, className }) {
  const reduceMotion = useReducedMotion();
  const reveal = animate && !reduceMotion;

  // initial={false} tells motion to start in the "visible" state, so nothing animates.
  const motionProps = reveal
    ? { initial: "hidden", animate: "visible" }
    : { initial: false, animate: "visible" };

  return (
    <m.ol
      aria-label={t("system.timeline.label")}
      variants={listVariants}
      {...motionProps}
      className={cn("flex flex-col", className)}
    >
      {steps.map((step, index) => (
        <TimelineStep
          key={`${step.status}-${index}`}
          step={step}
          isLast={index === steps.length - 1}
          nextUpcoming={steps[index + 1]?.state === "upcoming"}
        />
      ))}
    </m.ol>
  );
}

function TimelineStep({ step, isLast, nextUpcoming }) {
  const meta = STATUS_META[step.status] ?? STATUS_META.submitted;
  const Icon = meta.icon;
  const upcoming = step.state === "upcoming";
  const current = step.state === "current";

  return (
    <m.li
      variants={stepVariants}
      aria-current={current ? "step" : undefined}
      className={cn("relative flex gap-4", !isLast && "pb-6")}
    >
      {/* Connector to the next step: darker while the path is walked, light towards upcoming. */}
      {!isLast && (
        <m.span
          aria-hidden="true"
          variants={lineVariants}
          className={cn(
            "absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 origin-top",
            nextUpcoming || upcoming ? "bg-border" : "bg-input",
          )}
        />
      )}

      {/* Square marker like a rubber stamp (round shapes are kept for avatars, chat and the postmark). */}
      <span
        aria-hidden="true"
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-sm",
          upcoming
            ? "border border-dashed border-input bg-card text-muted-foreground"
            : meta.className,
          current && "ring-2 ring-current ring-offset-2 ring-offset-background",
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 leading-8">
          <span
            className={cn("font-medium", upcoming ? "text-muted-foreground" : "text-foreground")}
          >
            {step.label ?? t(meta.labelKey)}
          </span>
          {current && (
            <span className="text-sm text-muted-foreground">{t("system.timeline.now")}</span>
          )}
          {upcoming && <span className="sr-only">{t("system.timeline.upcoming")}</span>}
        </p>
        {step.at && <p className="text-sm text-muted-foreground tabular-nums">{step.at}</p>}
        {step.note && <p className="max-w-prose text-sm text-foreground">{step.note}</p>}
      </div>
    </m.li>
  );
}

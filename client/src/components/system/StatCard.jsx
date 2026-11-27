import { useRef } from "react";
import NumberFlow from "@number-flow/react";
import { useInView, useReducedMotion } from "motion/react";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { durations, easings, toCssEasing, toMs } from "./motionTokens";

// NumberFlow animates with the Web Animations API; keep each run within the `slow` token (320ms).
const transformTiming = { duration: toMs(durations.slow), easing: toCssEasing(easings.standard) };
const opacityTiming = { duration: toMs(durations.base), easing: toCssEasing(easings.enter) };

/**
 * A headline number with a label (dashboard tiles, the Landing stats row).
 * It counts up from 0 the first time it scrolls into view. With reduced motion, or where
 * IntersectionObserver is missing, it simply shows the value. Indian grouping (1,50,000).
 * `format` takes Intl.NumberFormat options, e.g. { style: "percent" }.
 */
export function StatCard({ label, value, prefix, suffix, hint, format, empty, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const canObserve = typeof IntersectionObserver !== "undefined";
  const shown = inView || reduceMotion || !canObserve ? value : 0;

  // Screen readers get the final value straight away, never the 0 or the in-between digits.
  const readable = `${prefix ?? ""}${new Intl.NumberFormat("en-IN", format).format(value)}${suffix ?? ""}`;

  return (
    <div
      ref={ref}
      data-slot="stat-card"
      className={cn("flex flex-col gap-2 rounded-lg border bg-card p-4 md:p-6", className)}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      {empty ? (
        // No data yet: a plain sentence instead of a 0 that reads like a result.
        <p className="text-base text-muted-foreground">{t("system.stats.empty")}</p>
      ) : (
        <StatValue
          readable={readable}
          shown={shown}
          format={format}
          prefix={prefix}
          suffix={suffix}
          reduceMotion={reduceMotion}
        />
      )}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatValue({ readable, shown, format, prefix, suffix, reduceMotion }) {
  return (
    <p className="font-display text-3xl leading-tight font-semibold text-foreground tabular-nums">
      <span className="sr-only">{readable}</span>
      <NumberFlow
        aria-hidden="true"
        value={shown}
        locales="en-IN"
        format={format}
        prefix={prefix}
        suffix={suffix}
        animated={!reduceMotion}
        respectMotionPreference
        transformTiming={transformTiming}
        spinTiming={transformTiming}
        opacityTiming={opacityTiming}
      />
    </p>
  );
}

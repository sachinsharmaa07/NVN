import { cn } from "@/lib/utils";
import { t } from "@/i18n/t";
import { BADGE_CLASS, SLA_META } from "./statusMeta";

/**
 * SLA state as icon + label. `breached` reads "Overdue"; `paused` is shown when the clock is on hold.
 * <SlaBadge state="at_risk" />
 */
export function SlaBadge({ state, className, ...props }) {
  const meta = SLA_META[state];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      data-slot="sla-badge"
      data-state={state}
      className={cn(BADGE_CLASS, meta.className, className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      {t(meta.labelKey)}
    </span>
  );
}

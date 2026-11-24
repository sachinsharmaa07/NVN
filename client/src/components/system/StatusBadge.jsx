import { cn } from "@/lib/utils";
import { t } from "@/i18n/t";
import { BADGE_CLASS, STATUS_META } from "./statusMeta";

/**
 * Issue status as icon + label, never colour alone.
 * <StatusBadge status="in_progress" />
 */
export function StatusBadge({ status, className, ...props }) {
  const meta = STATUS_META[status];
  // An unknown value is a bug upstream; render nothing rather than a misleading colour.
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(BADGE_CLASS, meta.className, className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      {t(meta.labelKey)}
    </span>
  );
}

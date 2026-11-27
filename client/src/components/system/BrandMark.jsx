import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

/*
 * Nivaran's mark and wordmark (docs/UI.md §1.2): a pin inside a PIN box. The SVG is decorative; the
 * wordmark text is the accessible name. Used in the TopBar, SuspendedLayout and Landing footer only.
 */
export function BrandMark({ className }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        focusable="false"
        className="size-5 shrink-0 text-primary"
      >
        <rect
          x="1"
          y="1"
          width="18"
          height="18"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="13" cy="13" r="3" fill="currentColor" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-wordmark">{t("app.name")}</span>
    </span>
  );
}

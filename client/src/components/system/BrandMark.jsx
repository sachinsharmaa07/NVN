import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

/*
 * Nivaran's mark and wordmark (docs/UI.md §1.2): a pin inside a PIN box. The SVG is decorative; the
 * wordmark text is the accessible name. Used in the TopBar, SuspendedLayout and Landing footer only.
 * size: "md" (20px mark and text, the top bar) or "sm" (16px, the Landing footer), per 02-lld §2.
 */
const SIZES = {
  md: { mark: "size-5", text: "text-xl" },
  sm: { mark: "size-4", text: "text-base" },
};

export function BrandMark({ size = "md", className }) {
  const { mark, text } = SIZES[size] ?? SIZES.md;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        focusable="false"
        className={cn("shrink-0 text-primary", mark)}
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
      <span className={cn("font-display font-semibold tracking-wordmark", text)}>
        {t("app.name")}
      </span>
    </span>
  );
}

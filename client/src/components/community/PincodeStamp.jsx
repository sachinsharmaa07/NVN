import { t } from "@/i18n/t";

/**
 * A pincode drawn as six small boxes, the same India Post envelope motif as the report wizard (UI.md §1),
 * read-only here: it heads the community feed as the one bold element on the page.
 */
export function PincodeStamp({ pincode }) {
  return (
    <span
      role="img"
      aria-label={t("community.feed.headingLabel", { pincode })}
      className="flex gap-1.5"
    >
      {pincode.split("").map((digit, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="flex h-11 w-8 items-center justify-center rounded-sm border-2 border-input bg-card font-display text-2xl font-semibold tabular-nums sm:h-12 sm:w-9"
        >
          {digit}
        </span>
      ))}
    </span>
  );
}

import { CheckIcon } from "lucide-react";
import { CATEGORIES } from "@/components/report/categories";
import { t } from "@/i18n/t";

/**
 * Radio cards: real radio inputs (arrow keys move between them), the card is their label.
 * Selected shows three ways (border, fill, a check that fades in `fast`), never by colour alone; no scale.
 */
export function CategoryCards({ value, onChange, errorId, invalid }) {
  return (
    <fieldset
      className="flex flex-col gap-3"
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
    >
      <legend className="mb-1 text-base font-medium">{t("report.details.categoryLabel")}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORIES.map(({ value: category, Icon, label }) => (
          <label
            key={category}
            className="group flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name="category"
              value={category}
              checked={value === category}
              onChange={() => onChange(category)}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="text-sm font-medium">{t(label)}</span>
            <CheckIcon
              aria-hidden="true"
              className="ml-auto size-4 shrink-0 text-primary opacity-0 transition-opacity duration-fast ease-standard group-has-checked:opacity-100"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

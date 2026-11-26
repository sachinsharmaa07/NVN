import { CATEGORIES } from "@/components/report/categories";
import { t } from "@/i18n/t";

/** Radio cards: real radio inputs (arrow keys move between them), the card is their label. */
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
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
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
          </label>
        ))}
      </div>
    </fieldset>
  );
}

import { StatCard } from "@/components/system/StatCard";
import { t } from "@/i18n/t";

// MOCK: sample numbers until the dashboard API exists (Phase 4)
const SAMPLE_STATS = [
  { key: "reported", value: 12480 },
  { key: "fixed", value: 9312 },
  { key: "onTime", value: 87, suffix: "%" },
  { key: "wards", value: 64 },
];

/** Four headline numbers. StatCard handles Indian grouping (12,480 / 1,50,000) and count-up. */
export function StatsRow() {
  return (
    <section aria-labelledby="landing-stats-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="landing-stats-title" className="font-display text-2xl font-semibold">
          {t("landing.stats.title")}
        </h2>
        {/* Says plainly that these are not real figures yet. */}
        <p className="max-w-prose text-sm text-muted-foreground">{t("landing.stats.sampleNote")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {SAMPLE_STATS.map(({ key, value, suffix }) => (
          <li key={key}>
            <StatCard label={t(`landing.stats.${key}`)} value={value} suffix={suffix} />
          </li>
        ))}
      </ul>
    </section>
  );
}

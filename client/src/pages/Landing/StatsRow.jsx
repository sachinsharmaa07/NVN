import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/system/StatCard";
import { t } from "@/i18n/t";
import { apiGet } from "@/lib/api";

// GET /api/stats is public (no token) and cached 5 minutes by the server, so this matches its max-age.
function useStats() {
  return useQuery({
    queryKey: ["stats"],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => apiGet("/api/stats", { signal }),
  });
}

/**
 * Headline numbers from GET /api/stats, as their own section with an h2 once there are reports. Before
 * the first one there are no numbers to show, so there is no section either (review m11): StatsNote puts
 * one honest sentence at the end of "How it works" instead of four zeros that read as "nothing was ever
 * fixed". While loading or if the stats fail, both are left out.
 */
export function StatsRow({ className }) {
  const { data } = useStats();
  if (!data || data.totalReports === 0) return null;
  return (
    <section aria-labelledby="landing-stats-title" className={className}>
      <h2 id="landing-stats-title" className="mb-6 font-display text-2xl font-semibold lg:text-h2">
        {t("landing.stats.title")}
      </h2>
      <StatCards data={data} />
    </section>
  );
}

/** Zero reports so far: the one sentence that stands in for the stats section. */
export function StatsNote() {
  const { data } = useStats();
  if (data?.totalReports !== 0) return null;
  return <p className="mt-6 max-w-prose text-muted-foreground">{t("landing.stats.none")}</p>;
}

function StatCards({ data }) {
  const open = Object.values(data.openByCategory ?? {}).reduce((sum, n) => sum + n, 0);
  const median = data.medianResolutionHours;
  const cards = [
    { key: "reported", value: data.totalReports },
    { key: "fixed", value: data.resolved },
    { key: "open", value: open },
    // No median until an issue is fixed: say so instead of showing "0 h".
    {
      key: "medianHours",
      value: median ?? 0,
      empty: median == null,
      suffix: t("landing.stats.hours"),
    },
  ];
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
      {cards.map(({ key, value, suffix, empty }) => (
        <li key={key}>
          <StatCard label={t(`landing.stats.${key}`)} value={value} suffix={suffix} empty={empty} />
        </li>
      ))}
    </ul>
  );
}

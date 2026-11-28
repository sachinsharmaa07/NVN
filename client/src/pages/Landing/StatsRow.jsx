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
 * Headline numbers from GET /api/stats, honest at every size: before the first report there is one
 * sentence, not four zeros that read as "nothing was ever fixed". While loading or if the stats fail,
 * the section is left out.
 */
export function StatsRow({ className }) {
  const { data } = useStats();
  if (!data) return null;
  return (
    <section aria-labelledby="landing-stats-title" className={className}>
      <h2 id="landing-stats-title" className="mb-6 font-display text-2xl font-semibold lg:text-h2">
        {t("landing.stats.title")}
      </h2>
      {data.totalReports === 0 ? (
        <p className="max-w-prose text-muted-foreground">{t("landing.stats.none")}</p>
      ) : (
        <StatCards data={data} />
      )}
    </section>
  );
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

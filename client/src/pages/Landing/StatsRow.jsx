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
 * Four headline numbers from GET /api/stats. StatCard handles Indian grouping (12,480) and count-up.
 * While loading or if the stats fail, the row is left out: zeros would read as "nothing was ever fixed".
 */
export function StatsRow() {
  const { data } = useStats();
  if (!data) return null;
  const open = Object.values(data.openByCategory ?? {}).reduce((sum, n) => sum + n, 0);
  const cards = [
    { key: "reported", value: data.totalReports },
    { key: "fixed", value: data.resolved },
    { key: "open", value: open },
    {
      key: "medianHours",
      value: data.medianResolutionHours ?? 0,
      suffix: t("landing.stats.hours"),
    },
  ];
  return (
    <section aria-labelledby="landing-stats-title" className="flex flex-col gap-6">
      <h2 id="landing-stats-title" className="font-display text-2xl font-semibold">
        {t("landing.stats.title")}
      </h2>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {cards.map(({ key, value, suffix }) => (
          <li key={key}>
            <StatCard label={t(`landing.stats.${key}`)} value={value} suffix={suffix} />
          </li>
        ))}
      </ul>
    </section>
  );
}

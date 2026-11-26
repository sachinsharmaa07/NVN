import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// Cities the actor may pick, searched by name prefix (`q`), first 50 matches: their own for a city
// admin, any for a super admin. 637 cities is too many to load at once.
export function useCities({ enabled = true, q = "" } = {}) {
  const api = useApi();
  const query = q.trim();
  return useQuery({
    queryKey: ["geo", "cities", query],
    enabled,
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData, // keep the old list on screen while the next search loads
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({ limit: "50" });
      if (query) qs.set("q", query);
      return (await api(`/api/cities?${qs}`, { signal })).items;
    },
  });
}

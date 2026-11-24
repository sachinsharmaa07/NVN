import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// Cities the actor may pick: their own for a city admin, all for a super admin. Rarely changes.
export function useCities({ enabled = true } = {}) {
  const api = useApi();
  return useQuery({
    queryKey: ["geo", "cities"],
    enabled,
    staleTime: 60 * 60_000,
    queryFn: async ({ signal }) => (await api("/api/cities", { signal })).items,
  });
}

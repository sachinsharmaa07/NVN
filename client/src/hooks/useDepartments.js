import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// Departments of one city, for the role dialog. Only asks once a city is chosen.
export function useDepartments(cityId) {
  const api = useApi();
  return useQuery({
    queryKey: ["geo", "departments", cityId],
    enabled: Boolean(cityId),
    staleTime: 60 * 60_000,
    queryFn: async ({ signal }) =>
      (await api(`/api/departments?cityId=${encodeURIComponent(cityId)}`, { signal })).items,
  });
}

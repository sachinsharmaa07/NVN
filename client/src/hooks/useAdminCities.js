import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

const CITIES_KEY = ["admin", "cities"];
const PAGE_SIZE = 25;

/**
 * Cities for the super admin (GET /api/admin/cities), one status tab at a time, cursor-paginated.
 * keepPreviousData: changing the tab, the state or the search keeps the old rows (dimmed by
 * LedgerTable) until the new ones arrive.
 */
export function useAdminCities({ status = "active", stateCode = "", q = "" }) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: [...CITIES_KEY, { status, stateCode, q }],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), status });
      if (stateCode) params.set("stateCode", stateCode);
      if (q) params.set("q", q);
      if (pageParam) params.set("cursor", pageParam);
      return api(`/api/admin/cities?${params}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

/** POST /api/admin/cities: { name, code, stateCode }. Not optimistic: the list refetches on success. */
export function useCreateCity() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api("/api/admin/cities", { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CITIES_KEY }),
  });
}

/** PATCH /api/admin/cities/:id: { name?, status? }. Pause is status "onboarding", Open is "active". */
export function useUpdateCity() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api(`/api/admin/cities/${id}`, { method: "PATCH", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CITIES_KEY }),
  });
}

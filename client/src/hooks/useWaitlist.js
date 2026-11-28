import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

/**
 * The most-requested pincodes (GET /api/admin/waitlist?limit=). A top-N report: no cursor, so a plain
 * query; changing the limit keeps the old rows until the new list arrives.
 */
export function useWaitlist({ limit = 20 }) {
  const api = useApi();
  return useQuery({
    queryKey: ["admin", "waitlist", limit],
    queryFn: ({ signal }) => api(`/api/admin/waitlist?limit=${limit}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

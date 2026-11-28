import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

/**
 * The audit feed (GET /api/admin/audit), newest first, 25 a page; "Load more" sends the cursor.
 * keepPreviousData: a filter change keeps the old rows (dimmed) until the new ones arrive.
 */
export function useAudit({ action = "", targetType = "" }) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["admin", "audit", { action, targetType }],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "25" });
      if (action) params.set("action", action);
      if (targetType) params.set("targetType", targetType);
      if (pageParam) params.set("cursor", pageParam);
      return api(`/api/admin/audit?${params}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

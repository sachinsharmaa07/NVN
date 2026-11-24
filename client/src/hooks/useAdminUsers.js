import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export const PAGE_SIZE = 25;

/*
 * The admin user list. The API is cursor-based (no total, no page numbers), so this is an
 * infinite query: each "Load more" fetches the next cursor. The filters are part of the cache
 * key, so changing one starts a fresh list from the top. `q` is only sent at 3+ characters
 * (the server's minimum). Every mutation invalidates ["admin", "users"], which refreshes this.
 */
export function useAdminUsers({ q = "", role = "", status = "" }) {
  const api = useApi();
  const search = q.length >= 3 ? q : "";
  return useInfiniteQuery({
    queryKey: ["admin", "users", "list", { q: search, role, status }],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (search) params.set("q", search);
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      if (pageParam) params.set("cursor", pageParam);
      return api(`/api/admin/users?${params}`, { signal });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

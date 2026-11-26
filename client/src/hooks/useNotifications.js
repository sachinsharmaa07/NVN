import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export const NOTIFICATIONS_KEY = ["notifications"];

/**
 * The newest page of my notifications plus the `unread` count, every 60 s. TanStack Query pauses the
 * interval while the tab is hidden (refetchIntervalInBackground defaults to false).
 */
export function useNotifications({ enabled }) {
  const api = useApi();
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    enabled,
    refetchInterval: 60_000,
    queryFn: ({ signal }) => api("/api/notifications?limit=20", { signal }),
  });
}

export function useMarkAllRead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/notifications/read", { method: "POST", body: {} }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

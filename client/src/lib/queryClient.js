import { QueryClient } from "@tanstack/react-query";

// Retry once, and only when trying again could help: network trouble, a timeout or a 5xx.
// 4xx answers (bad input, not found) and 503 (a real "database down" answer) are final.
export function shouldRetry(failureCount, error) {
  if (failureCount >= 1) return false;
  if (error?.code === "NETWORK_ERROR" || error?.code === "TIMEOUT") return true;
  return error?.status >= 500 && error.status !== 503;
}

// One client for the whole app (TanStack Query v5 defaults, adjusted):
// - staleTime 30s: data counts as fresh for 30s, so moving between pages doesn't refetch at once.
// - retry: at most 1, see shouldRetry above.
// - refetchOnWindowFocus stays on (default): coming back to the tab refreshes stale data.
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry },
      mutations: { retry: 0 },
    },
  });
}

export const queryClient = createQueryClient();

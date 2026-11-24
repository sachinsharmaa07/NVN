import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { authedRequest } from "@/lib/authedRequest";

// The cache key for "who am I". Profile saves write here; guards and menus read through useAuth.
export const ME_KEY = ["me"];

/*
 * The /api/me query, owned by AuthProvider (it is the only caller; everything else uses useMe()).
 * - staleTime 5 minutes: moving around the app does not refetch it.
 * - refetchOnWindowFocus stays on: coming back to the tab after 5+ minutes re-reads it, so a
 *   demotion or suspension shows up without polling.
 * - The first call after sign-in also creates the user record on the server.
 */
export function useMeQuery({ getAuthHeaders, enabled }) {
  return useQuery({
    queryKey: ME_KEY,
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) =>
      (await authedRequest(getAuthHeaders, "/api/me", { signal })).user,
  });
}

// For components: the current user and whether we are still finding out who they are.
export function useMe() {
  const { user, status } = useAuth();
  return { user, status, isLoading: status === "loading" };
}

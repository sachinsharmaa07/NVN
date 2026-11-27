import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { prefetchRoute } from "@/lib/prefetch";

/**
 * Handlers that start loading a page the moment the user shows intent (UI.md §5.2): a mouse hover,
 * keyboard focus or a finger landing. Spread onto a link: <NavLink to="/issues" {...useNavIntent("/issues")} />.
 */
export function useNavIntent(path) {
  const queryClient = useQueryClient();
  const api = useApi();
  const { status } = useAuth();
  return useMemo(() => {
    const prefetch = () =>
      prefetchRoute(path, { queryClient, api, signedIn: status === "signedIn" });
    return { onPointerEnter: prefetch, onFocus: prefetch, onTouchStart: prefetch };
  }, [path, queryClient, api, status]);
}

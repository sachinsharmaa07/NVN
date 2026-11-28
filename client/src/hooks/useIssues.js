import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { useApi } from "@/hooks/useApi";
import { t } from "@/i18n/t";

export const MINE_KEY = ["issues", "mine"];
export const detailKey = (ticketId) => ["issues", "detail", ticketId];

/** My issues query options, shared by the hook and the nav prefetch (lib/prefetch.js). */
export const myIssuesQuery = (api) =>
  infiniteQueryOptions({
    queryKey: MINE_KEY,
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      api(`/api/issues/mine?limit=20${pageParam ? `&cursor=${pageParam}` : ""}`, { signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** My issues, newest first; "Load more" fetches the next cursor (ARCHITECTURE 18.5). */
export function useMyIssues() {
  const api = useApi();
  return useInfiniteQuery(myIssuesQuery(api));
}

/** One ticket's query options, shared by the hook and the card prefetch (lib/prefetch.js). */
export const issueDetailQuery = (api, ticketId) =>
  queryOptions({
    queryKey: detailKey(ticketId),
    queryFn: ({ signal }) => api(`/api/issues/${ticketId}`, { signal }),
  });

export function useIssue(ticketId) {
  const api = useApi();
  return useQuery(issueDetailQuery(api, ticketId));
}

/** A 409 means someone else moved the issue first: say so and fetch the latest (never optimistic). */
export function onConflict(error, refetch) {
  if (error?.status !== 409) return false;
  toast.error(t("issues.conflict"));
  refetch();
  return true;
}

/**
 * The reporter's answer to "Is it fixed?": `action` is "confirm" or "reopen" (with `note`).
 * The server's answer replaces the cached ticket; My issues refetches.
 */
export function useResolveAnswer(ticketId) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, version, note }) =>
      api(`/api/issues/${ticketId}/${action}`, {
        method: "POST",
        body: action === "reopen" ? { note, version } : { version },
      }),
    onSuccess: (issue, { action }) => {
      toast.success(t(action === "reopen" ? "issues.resolve.reopened" : "issues.resolve.closed"));
      queryClient.setQueryData(detailKey(ticketId), issue);
      queryClient.invalidateQueries({ queryKey: MINE_KEY });
    },
    onError: (error) =>
      onConflict(error, () => queryClient.invalidateQueries({ queryKey: detailKey(ticketId) })),
  });
}

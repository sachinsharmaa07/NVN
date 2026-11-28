import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { onConflict } from "@/hooks/useIssues";
import { t } from "@/i18n/t";

export const STAFF_KEY = ["staff", "issues"];

/** Staff queue query options, shared by the hook and the nav prefetch (default filters there). */
export const staffQueueQuery = (api, { status = "", sla = "", category = "", queue = "" } = {}) =>
  infiniteQueryOptions({
    queryKey: [...STAFF_KEY, { status, sla, category, queue }],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "25" });
      if (status) params.set("status", status);
      if (sla) params.set("sla", sla);
      if (category) params.set("category", category);
      if (queue) params.set("queue", queue);
      if (pageParam) params.set("cursor", pageParam);
      return api(`/api/staff/issues?${params}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/**
 * The staff queue, sorted by the server (expectedBy, then createdAt). Filters are part of the key.
 * keepPreviousData: a filter change keeps the old rows on screen (dimmed by the page) until the new
 * ones arrive, so the list never blanks to a skeleton.
 */
export function useStaffIssues(filters) {
  const api = useApi();
  return useInfiniteQuery({ ...staffQueueQuery(api, filters), placeholderData: keepPreviousData });
}

/**
 * One staff write on an issue: { ticketId, action: "status" | "assign" | "hold" | "resume", body }.
 * `body` already carries the issue's `version`. Never optimistic: success toasts `done` and refetches the
 * queue; a 409 says someone else got there first and refetches too, so the drawer shows the new version.
 */
export function useStaffAction() {
  const api = useApi();
  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: STAFF_KEY });
  return useMutation({
    mutationFn: ({ ticketId, action, body }) =>
      api(`/api/issues/${ticketId}/${action}`, {
        method: action === "status" || action === "assign" ? "PATCH" : "POST",
        body,
      }),
    onSuccess: (_issue, { done }) => {
      toast.success(done);
      return refetch();
    },
    onError: (error) => onConflict(error, refetch),
  });
}

/** For the drawer forms: runs one write with the issue's version; `error` is the text to announce. */
export function useStaffSubmit(issue, onDone) {
  const mutation = useStaffAction();
  const [error, setError] = useState("");
  async function submit(action, body, done) {
    setError("");
    try {
      await mutation.mutateAsync({
        ticketId: issue.ticketId,
        action,
        body: { ...body, version: issue.version },
        done,
      });
      onDone();
    } catch (e) {
      setError(e.status === 409 ? t("issues.conflict") : e.message);
    }
  }
  return { submit, error, pending: mutation.isPending };
}

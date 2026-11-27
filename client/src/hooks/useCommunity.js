import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { t } from "@/i18n/t";

export const feedKey = (pincode) => ["community", "feed", pincode];
export const postKey = (id) => ["community", "post", id];
export const commentsKey = (id) => ["community", "comments", id];

const withCursor = (path, cursor) => `${path}${cursor ? `&cursor=${cursor}` : ""}`;

/** One pincode's feed, newest first; "Load more" fetches the next cursor. */
export function useFeed(pincode) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: feedKey(pincode),
    enabled: Boolean(pincode),
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      api(withCursor(`/api/community/posts?pincode=${pincode}&limit=20`, pageParam), { signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function usePost(id) {
  const api = useApi();
  return useQuery({
    queryKey: postKey(id),
    queryFn: ({ signal }) => api(`/api/community/posts/${id}`, { signal }),
  });
}

export function useComments(id) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: commentsKey(id),
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      api(withCursor(`/api/community/posts/${id}/comments?limit=50`, pageParam), { signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Not optimistic: the server picks the pincode and the id. The new post goes on top of its feed. */
export function useCreatePost() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api("/api/community/posts", { method: "POST", body }),
    onSuccess: (post) => {
      toast.success(t("community.composer.published"));
      queryClient.invalidateQueries({ queryKey: feedKey(post.pincode) });
    },
  });
}

/**
 * Optimistic (UI.md §7): the comment shows at once as "Sending…", is replaced by the server's copy, and
 * is removed again with a Retry toast if the request fails.
 */
export function useAddComment(postId, author) {
  const api = useApi();
  const queryClient = useQueryClient();
  const key = commentsKey(postId);
  return useMutation({
    mutationFn: (body) => api(`/api/community/posts/${postId}/comments`, { method: "POST", body }),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData(key);
      const temp = {
        id: `pending-${Date.now()}`,
        parentId: body.parentId ?? null,
        body: body.body,
        author,
        mine: true,
        pending: true,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(key, (data) => {
        if (!data) return data;
        const pages = [...data.pages];
        const last = pages.length - 1;
        pages[last] = { ...pages[last], items: [...pages[last].items, temp] };
        return { ...data, pages };
      });
      return { before };
    },
    onError: (error, body, context) => {
      queryClient.setQueryData(key, context?.before);
      toast.error(t("community.comments.failed"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: postKey(postId) });
    },
  });
}

export function useFlag() {
  const api = useApi();
  return useMutation({
    mutationFn: (body) => api("/api/community/flags", { method: "POST", body }),
    onSuccess: () => toast.success(t("community.report.sent")),
    onError: () => toast.error(t("community.report.failed")),
  });
}

/** `kind` "post" or "comment"; the author's own soft delete. */
export function useDeleteContent(kind, { postId, pincode } = {}) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api(`/api/community/${kind === "post" ? "posts" : "comments"}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t(kind === "post" ? "community.post.deleted" : "community.comments.deleted"));
      if (pincode) queryClient.invalidateQueries({ queryKey: feedKey(pincode) });
      if (postId) {
        queryClient.invalidateQueries({ queryKey: commentsKey(postId) });
        queryClient.invalidateQueries({ queryKey: postKey(postId) });
      }
    },
    onError: () => toast.error(t("errors.common.network")),
  });
}

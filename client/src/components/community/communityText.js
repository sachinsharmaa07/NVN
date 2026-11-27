import { t } from "@/i18n/t";
import { formatDateTime } from "@/lib/format";

/** "Asha, 26 Nov, 5:00 PM" (no middle dots, UI.md §1). An empty name reads "A resident". */
export const bylineOf = (item) =>
  t("community.post.byline", {
    author: item.author || t("community.post.anonymous"),
    date: formatDateTime(item.createdAt),
  });

export function commentCountLabel(count) {
  if (count === 0) return t("community.post.noComments");
  if (count === 1) return t("community.post.oneComment");
  return t("community.post.comments", { count: new Intl.NumberFormat("en-IN").format(count) });
}

/** Top-level comments in order, each with its replies. A reply whose parent is gone is dropped. */
export function threadOf(comments) {
  const replies = new Map();
  for (const c of comments) {
    if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
  }
  return comments
    .filter((c) => !c.parentId)
    .map((c) => ({ ...c, replies: replies.get(c.id) ?? [] }));
}

import { MessageSquareIcon } from "lucide-react";
import { Link } from "react-router";
import { focusRing } from "@/components/nav/navStyles";
import { bylineOf, commentCountLabel } from "./communityText";
import { cn } from "@/lib/utils";

/** One notice in the feed. The whole card is the link (UI.md §6): border only, no lift on hover. */
export function PostCard({ post }) {
  return (
    <Link
      to={`/community/${post.id}`}
      className={cn(
        "flex h-full flex-col gap-2 rounded-lg border bg-card p-4 transition-colors duration-fast ease-standard hover:border-input",
        focusRing,
      )}
    >
      <h2 className="text-lg font-semibold leading-snug text-foreground">{post.title}</h2>
      <p className="line-clamp-3 text-muted-foreground">{post.body}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-2 text-sm text-muted-foreground">
        <span>{bylineOf(post)}</span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <MessageSquareIcon aria-hidden="true" className="size-4" />
          {commentCountLabel(post.commentCount)}
        </span>
      </div>
    </Link>
  );
}

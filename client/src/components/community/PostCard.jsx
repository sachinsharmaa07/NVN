import { MessageSquareIcon } from "lucide-react";
import { Link } from "react-router";
import { focusRing } from "@/components/nav/navStyles";
import { useNavIntent } from "@/hooks/useNavIntent";
import { cn } from "@/lib/utils";
import { bylineOf, commentCountLabel } from "./communityText";

/**
 * One notice on the board. The whole card is the link (UI.md §6): border only, no lift on hover; hovering
 * or touching it starts loading the post page. A container query puts the byline and the comment count
 * on one line once the card is wide enough.
 */
export function PostCard({ post }) {
  const to = `/community/${post.id}`;
  const intent = useNavIntent(to);
  return (
    <Link
      to={to}
      {...intent}
      className={cn(
        "@container flex h-full flex-col gap-2 rounded-lg border bg-card p-4 transition-colors duration-fast ease-standard hover:border-input",
        focusRing,
      )}
    >
      <h3 className="font-display text-h3 font-semibold text-foreground">{post.title}</h3>
      <p className="line-clamp-4 text-muted-foreground">{post.body}</p>
      <div className="mt-auto flex flex-col gap-1 pt-2 text-sm text-muted-foreground @sm:flex-row @sm:items-center @sm:justify-between @sm:gap-4">
        <span>{bylineOf(post)}</span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <MessageSquareIcon aria-hidden="true" className="size-4" />
          {commentCountLabel(post.commentCount)}
        </span>
      </div>
    </Link>
  );
}

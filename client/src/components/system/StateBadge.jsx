import { cn } from "@/lib/utils";
import { BADGE_CLASS } from "./statusMeta";

// Non-issue states borrow the issue status tokens (already contrast-checked in both themes), by meaning.
const TONES = {
  good: "bg-status-resolved text-status-resolved-foreground",
  neutral: "bg-status-closed text-status-closed-foreground",
  bad: "bg-status-rejected text-status-rejected-foreground",
};

/**
 * The state of something that isn't an issue (a city, a user, a post, a waitlist pincode), shaped like
 * StatusBadge: icon + label, never colour alone (UI.md §9).
 * <StateBadge tone="good" icon={CircleCheck}>Active</StateBadge>
 */
export function StateBadge({ tone = "neutral", icon: Icon, children, className }) {
  return (
    <span data-slot="state-badge" className={cn(BADGE_CLASS, TONES[tone], className)}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

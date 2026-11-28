import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { cn } from "@/lib/utils";

/**
 * First-load placeholder shaped like what is coming (UI.md §5.2, §6 Skeleton): `count` blocks of
 * `itemClassName` (the real card's height and corners) in the same grid (`className`). It shows only
 * after 200ms, so a fast answer never flashes a placeholder; until then the space is simply empty.
 * Render it only while loading; refetches keep the old content (dimmed) instead.
 */
export function SkeletonList({
  count = 3,
  itemClassName = "h-28 rounded-lg",
  className = "grid gap-3",
}) {
  const show = useDelayedFlag(true);
  if (!show) return null;
  return (
    <div aria-hidden="true" data-slot="skeleton-list" className={className}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("w-full", itemClassName)} />
      ))}
    </div>
  );
}

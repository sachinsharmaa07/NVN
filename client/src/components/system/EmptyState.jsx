import { cn } from "@/lib/utils";

/**
 * What to show when a list has nothing in it: what this is, why it is empty, and one next step
 * (UI.md §7). The page variant is the only centred block in the app besides the counterfoil.
 * `variant="inline"` sits inside a section instead: left-aligned, no icon tile.
 * Pass a lucide `icon` component, or your own `illustration` node (takes priority; page variant only).
 * `titleAs` sets the heading level so it fits the page outline (defaults to h2).
 */
export function EmptyState({
  variant = "page",
  icon: Icon,
  illustration,
  title,
  hint,
  action,
  titleAs: Title = "h2",
  className,
}) {
  if (variant === "inline") {
    return (
      <div
        data-slot="empty-state"
        className={cn("flex flex-col items-start gap-3 py-6", className)}
      >
        <Title className="font-display text-h3 font-semibold text-foreground">{title}</Title>
        {hint && <p className="max-w-prose text-muted-foreground">{hint}</p>}
        {action}
      </div>
    );
  }

  return (
    <div
      data-slot="empty-state"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center",
        className,
      )}
    >
      {illustration ??
        (Icon && (
          <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon aria-hidden="true" className="size-6" />
          </span>
        ))}
      <div className="flex flex-col gap-2">
        <Title className="font-display text-xl font-semibold text-foreground">{title}</Title>
        {hint && <p className="text-muted-foreground">{hint}</p>}
      </div>
      {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

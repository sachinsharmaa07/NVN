import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/**
 * Card: groups one thing (an issue, a post, a step). Border, never a shadow (docs/UI.md §3).
 * `interactive` is for a card that is itself a link: use it with `asChild` around a <Link>/<a> so the
 * whole card is the one focusable target. Hover lifts it 2px and darkens the border to `input`.
 */
function Card({ className, interactive = false, asChild = false, ...props }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="card"
      data-interactive={interactive ? "" : undefined}
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-card py-4 text-card-foreground md:gap-6 md:py-6",
        interactive &&
          "cursor-pointer transition-[translate,border-color] duration-fast ease-standard outline-none hover:-translate-y-0.5 hover:border-input focus-visible:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:hover:translate-y-0",
        className,
      )}
      {...props}
    />
  );
}
function CardHeader({ className, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-4 md:px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4 md:[.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}
function CardTitle({ className, ...props }) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-display text-xl leading-tight font-semibold", className)}
      {...props}
    />
  );
}
function CardDescription({ className, ...props }) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
function CardAction({ className, ...props }) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}
function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn("px-4 md:px-6", className)} {...props} />;
}
function CardFooter({ className, ...props }) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center px-4 md:px-6 [.border-t]:pt-4 md:[.border-t]:pt-6",
        className,
      )}
      {...props}
    />
  );
}
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };

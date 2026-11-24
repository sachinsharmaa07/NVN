import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

// Restyled to docs/UI.md §6: every size is at least 44px tall, focus ring is 2px solid `ring` with a
// 2px offset, colour changes use the `fast` duration, and a press scales to 0.98 (press-scale utility).
const buttonVariants = cva(
  "press-scale relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-base font-medium whitespace-nowrap transition-[color,background-color,border-color,scale] duration-fast ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // The one main action on a screen.
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        // Other actions next to the main one.
        secondary: "bg-secondary text-secondary-foreground hover:bg-border",
        // Actions inside cards and toolbars. `input` border so the edge meets 3:1.
        outline:
          "border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
        // Icon buttons and navigation.
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        // Delete or reject, always behind a confirm dialog.
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Inline text actions only. Underlined so it never relies on colour alone.
        link: "text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary",
      },
      size: {
        default: "h-11 px-4 has-[>svg]:px-3",
        sm: "h-11 gap-1 px-3 text-sm has-[>svg]:px-2",
        lg: "h-12 px-6 has-[>svg]:px-4",
        icon: "size-11",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Button. Pass `loading` (true/false) to a button that can be busy, e.g. "Submit report".
 * While loading it shows a spinner before the same label, is disabled and sets aria-busy.
 *
 * Width stays the same between idle and loading: both versions of the content sit in one grid cell
 * (grid-area 1/1), so the cell is always as wide as the wider (loading) version and only one of the
 * two is visible at a time. Buttons that never load (no `loading` prop) skip this and render plainly.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading,
  disabled,
  children,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button";
  const canLoad = loading !== undefined && !asChild;

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {canLoad ? (
        <span className="grid">
          <span
            aria-hidden={loading ? undefined : true}
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
              !loading && "invisible",
            )}
          >
            <Loader2 aria-hidden="true" className="animate-spin" />
            {children}
          </span>
          <span
            aria-hidden={loading ? true : undefined}
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
              loading && "invisible",
            )}
          >
            {children}
          </span>
        </span>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };

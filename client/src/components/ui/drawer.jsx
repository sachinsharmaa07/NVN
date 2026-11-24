import { cn } from "@/lib/utils";
import { Dialog as DrawerPrimitive } from "radix-ui";

/*
 * Bottom drawer for phones (docs/UI.md §6: Dialog on desktop, Drawer below 1024px).
 * The plan was shadcn's Drawer on Vaul, but the vaul package is not installed and adding packages
 * needs approval, so this is built on the Radix Dialog we already have. Same exports and
 * data-slot names as shadcn's Drawer, so Vaul (drag to dismiss) can be swapped in later without
 * changing any caller. Focus trap, Escape and overlay-to-close come from Radix.
 */
function Drawer({ ...props }) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}
function DrawerTrigger({ ...props }) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}
function DrawerClose({ ...props }) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}
function DrawerPortal({ ...props }) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}
function DrawerOverlay({ className, ...props }) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-sheet bg-foreground/40 duration-base data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-background/80",
        className,
      )}
      {...props}
    />
  );
}
function DrawerContent({ className, children, ...props }) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-sheet flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:duration-base data-[state=closed]:ease-exit data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:duration-slow data-[state=open]:ease-enter data-[state=open]:slide-in-from-bottom",
          className,
        )}
        {...props}
      >
        {/* Grab handle: a visual cue only (this drawer does not drag). */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted"
        />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}
function DrawerHeader({ className, ...props }) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1.5 px-4 text-left", className)}
      {...props}
    />
  );
}
function DrawerFooter({ className, ...props }) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}
function DrawerTitle({ className, ...props }) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}
function DrawerDescription({ className, ...props }) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};

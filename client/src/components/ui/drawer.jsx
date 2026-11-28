import { createContext, useContext, useRef } from "react";
import { useDragControls, useMotionValue, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { XIcon } from "lucide-react";
import { Dialog as DrawerPrimitive } from "radix-ui";
import { useReturnFocus } from "@/components/ui/returnFocus";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { shouldDismiss, springBack } from "./drawerDrag";

/*
 * Bottom drawer for phones (docs/UI.md §6: Dialog on desktop, Drawer below 1024px), built on the Radix
 * Dialog we already have (vaul is not installed). Same exports and data-slot names as shadcn's Drawer.
 * Focus trap, Escape and overlay-to-close come from Radix; drag to dismiss (UI.md §6.1) from motion.
 */
// The caller's onOpenChange, so a drag can close the drawer the same way Escape does.
const DrawerCloseContext = createContext(undefined);

function Drawer({ onOpenChange, ...props }) {
  return (
    <DrawerCloseContext.Provider value={onOpenChange}>
      <DrawerPrimitive.Root data-slot="drawer" onOpenChange={onOpenChange} {...props} />
    </DrawerCloseContext.Provider>
  );
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
// Overdamped bounce under reduced motion: the drawer returns at once instead of springing.
const INSTANT_RETURN = { bounceStiffness: 1e6, bounceDamping: 1e7 };

function DrawerContent({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }) {
  const onOpenChange = useContext(DrawerCloseContext);
  const focus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  const controls = useDragControls();
  const reduced = useReducedMotion();
  const panel = useRef(null);
  const y = useMotionValue(0);

  // Drag starts only from the handle or the header, so the list inside still scrolls.
  function startDrag(event) {
    if (event.target.closest('[data-slot="drawer-handle"], [data-slot="drawer-header"]')) {
      controls.start(event);
    }
  }
  function endDrag(_event, info) {
    const height = panel.current?.offsetHeight ?? 0;
    if (shouldDismiss({ offset: info.offset.y, velocity: info.velocity.y, height })) {
      onOpenChange?.(false);
    } else {
      springBack(y, reduced);
    }
  }

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content asChild {...props} {...focus}>
        <m.div
          ref={panel}
          data-slot="drawer-content"
          drag="y"
          dragListener={false}
          dragControls={controls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          dragMomentum={false}
          dragTransition={reduced ? INSTANT_RETURN : undefined}
          onPointerDown={startDrag}
          onDragEnd={endDrag}
          style={{ y }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-sheet flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:duration-base data-[state=closed]:ease-exit data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:duration-slow data-[state=open]:ease-enter data-[state=open]:slide-in-from-bottom",
            className,
          )}
        >
          {/* Grab handle: drag it (or the header) down to close. touch-none stops the page scrolling instead. */}
          <div
            data-slot="drawer-handle"
            aria-hidden="true"
            className="flex shrink-0 cursor-grab touch-none justify-center pt-3"
          >
            <div className="h-1.5 w-12 rounded-full bg-muted" />
          </div>
          {/* Dragging is never the only way out (WCAG 2.5.7): a close button, like the Dialog's. */}
          <DrawerPrimitive.Close
            data-slot="drawer-close"
            className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md opacity-70 transition-opacity duration-fast hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden [&_svg]:size-4"
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("common.close")}</span>
          </DrawerPrimitive.Close>
          {children}
        </m.div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}
function DrawerHeader({ className, ...props }) {
  return (
    <div
      data-slot="drawer-header"
      // pr-14 keeps a long title clear of the close button in the corner.
      className={cn("flex touch-none flex-col gap-1.5 px-4 pr-14 text-left", className)}
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

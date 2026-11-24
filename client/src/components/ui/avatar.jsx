import { cn } from "@/lib/utils";
import { Avatar as AvatarPrimitive } from "radix-ui";

// shadcn Avatar. Round is allowed for avatars (UI.md §3 radius `full`). The fallback shows when
// there is no image or it fails to load.
function Avatar({ className, ...props }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}
function AvatarImage({ className, ...props }) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  );
}
function AvatarFallback({ className, ...props }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}
export { Avatar, AvatarImage, AvatarFallback };

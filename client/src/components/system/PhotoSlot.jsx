import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A reserved 4:3 box where a photo will go (before/after pairs, empty photo grids). */
export function PhotoSlot({ label, className }) {
  return (
    <div
      data-slot="photo-slot"
      className={cn(
        "flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-input bg-muted/40 p-3 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <ImageIcon aria-hidden="true" className="size-4" />
      {label}
    </div>
  );
}

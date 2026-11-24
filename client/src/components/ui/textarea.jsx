import { cn } from "@/lib/utils";

// From shadcn new-york-v4 textarea.tsx, converted to JSX and restyled like Input (docs/UI.md):
// 16px text at every width (no md:text-sm), solid 2px focus ring with offset, `input` border for 3:1,
// destructive border + ring when aria-invalid. field-sizing-content grows it with its text.
function Textarea({ className, ...props }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base text-foreground shadow-sm transition-[color,box-shadow,border-color] duration-fast ease-standard outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

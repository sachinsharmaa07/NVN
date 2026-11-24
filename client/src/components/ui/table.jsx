import { cn } from "@/lib/utils";

// shadcn Table (UI.md §6: staff queue and admin lists at 1024px and up). Real <table> elements,
// so screen readers get row and column navigation. The wrapper scrolls sideways if it must.
function Table({ className, ...props }) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}
// Sticky header: stays under the 64px top bar while the page scrolls (z-sticky, UI.md §3).
function TableHeader({ className, ...props }) {
  return (
    <thead
      data-slot="table-header"
      className={cn("sticky top-16 z-sticky bg-background [&_tr]:border-b", className)}
      {...props}
    />
  );
}
function TableBody({ className, ...props }) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}
function TableRow({ className, ...props }) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b transition-colors duration-fast hover:bg-muted/50", className)}
      {...props}
    />
  );
}
function TableHead({ className, scope = "col", ...props }) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        "h-11 px-3 text-left align-middle font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
function TableCell({ className, ...props }) {
  return <td data-slot="table-cell" className={cn("p-3 align-middle", className)} {...props} />;
}
function TableCaption({ className, ...props }) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption };

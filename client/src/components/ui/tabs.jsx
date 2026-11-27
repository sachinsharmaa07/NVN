// shadcn tabs (radix-ui), restyled to docs/UI.md: focus ring matches button.jsx (2px solid `ring`, 2px
// offset). The active trigger carries a static underline indicator; step 03 animates it.
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex w-fit items-center gap-1 border-b border-border text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, children, ...props }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group/trigger relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-base font-medium whitespace-nowrap transition-colors duration-fast ease-standard outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <span
        data-slot="tabs-indicator"
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground opacity-0 group-data-[state=active]/trigger:opacity-100"
      />
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

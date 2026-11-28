// shadcn tabs (radix-ui), restyled to docs/UI.md: focus ring matches button.jsx (2px solid `ring`, 2px
// offset). The active trigger's underline slides to the next tab with springs.snappy (UI.md §4).
import { createContext, useContext, useId, useState } from "react";
import * as m from "motion/react-m";
import { Tabs as TabsPrimitive } from "radix-ui";

import { springs, useMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Which tab is active and a per-instance id, so two tab sets never share an indicator layoutId.
const TabsContext = createContext({ id: "", active: undefined });

function Tabs({ className, value, defaultValue, onValueChange, ...props }) {
  const id = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const active = value ?? uncontrolled;
  function change(next) {
    setUncontrolled(next);
    onValueChange?.(next);
  }
  return (
    <TabsContext.Provider value={{ id, active }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        value={active}
        onValueChange={change}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      />
    </TabsContext.Provider>
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

function TabsTrigger({ className, children, value, ...props }) {
  const { id, active } = useContext(TabsContext);
  const transition = useMotionSafe(springs.snappy);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-base font-medium whitespace-nowrap transition-colors duration-fast ease-standard outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      {value === active && (
        <m.span
          data-slot="tabs-indicator"
          aria-hidden="true"
          layoutId={`${id}-indicator`}
          transition={transition}
          className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
        />
      )}
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

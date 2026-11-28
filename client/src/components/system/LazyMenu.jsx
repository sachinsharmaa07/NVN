import { cloneElement, useEffect, useState } from "react";
import { whenIdle } from "@/lib/whenIdle";

// Modules already loaded, so a trigger that remounts (a route change) does not wait again.
const loaded = new Map();

/**
 * A closed menu whose code is not in the first download (HLD §7 critical-path budget).
 * `trigger` (a Button element) renders at once. `load` (a module-level import function) brings a
 * component that renders the real menu: <DropdownMenu defaultOpen={defaultOpen}> with
 * <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger> and its content. The module loads on
 * hover, focus or touch of the trigger and when the browser is idle. A click (or Enter/Space) before it
 * arrives is not lost: the menu opens as soon as it lands, and focus moves to the real trigger.
 * Works the same for a Sheet (`popup="dialog"`). Extra props go to the loaded component.
 */
export function LazyMenu({ load, trigger, popup = "menu", ...props }) {
  const [Menu, setMenu] = useState(() => loaded.get(load));
  const [openOnArrival, setOpenOnArrival] = useState(false);
  // Whether the placeholder has keyboard focus, so the real trigger can take it over.
  const [focused, setFocused] = useState(false);

  function fetchMenu() {
    load().then((mod) => {
      loaded.set(load, mod.default);
      setMenu(() => mod.default);
    });
  }
  // Preload once the page has painted, so most first clicks find the menu already here.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount; `load` is a stable module function
  useEffect(() => (Menu ? undefined : whenIdle(fetchMenu)), []);

  if (Menu) {
    // The placeholder is gone; a keyboard user keeps their place on the real trigger.
    const real = focused ? cloneElement(trigger, { autoFocus: true }) : trigger;
    return <Menu trigger={real} defaultOpen={openOnArrival} {...props} />;
  }
  return cloneElement(trigger, {
    "aria-haspopup": popup,
    "aria-expanded": false,
    onPointerEnter: fetchMenu,
    onFocus: () => {
      setFocused(true);
      fetchMenu();
    },
    onBlur: () => setFocused(false),
    onTouchStart: fetchMenu,
    onClick: () => {
      setOpenOnArrival(true);
      fetchMenu();
    },
    // The keys Radix's trigger opens on; Enter and Space also click, ArrowDown does not.
    onKeyDown: (event) => {
      if (["Enter", " ", "ArrowDown"].includes(event.key)) {
        setOpenOnArrival(true);
        fetchMenu();
      }
    },
  });
}

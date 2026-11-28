import { useEffect, useSyncExternalStore } from "react";
import { whenIdle } from "@/lib/whenIdle";

export const loadSidebarTooltip = () => import("./SidebarTooltip");

// The tooltip code is not in the first download (HLD §7). It loads when the browser is idle, the first
// time a collapsed sidebar needs it; until then the icons carry their names in aria-label only.
let ready = false;
let started = false;
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** True once the SidebarTooltip chunk has arrived (Sidebar then renders its React.lazy). */
export function useSidebarTooltip(needed) {
  const loaded = useSyncExternalStore(subscribe, () => ready);
  useEffect(() => {
    if (!needed || started) return undefined;
    started = true;
    return whenIdle(() =>
      loadSidebarTooltip().then(
        () => {
          ready = true;
          listeners.forEach((fn) => fn());
        },
        () => (started = false), // try again next time
      ),
    );
  }, [needed]);
  return loaded;
}

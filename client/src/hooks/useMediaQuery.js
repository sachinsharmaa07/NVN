import { useSyncExternalStore } from "react";

// Returns true while the CSS media query matches, e.g. useMediaQuery("(min-width: 1024px)").
// useSyncExternalStore subscribes to the browser's change events without an effect + state pair.
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false, // no window during server rendering: assume mobile-first
  );
}

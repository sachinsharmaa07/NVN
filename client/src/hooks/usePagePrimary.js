import { useEffect, useSyncExternalStore } from "react";

/*
 * One filled primary button per screen (UI.md §6). The sidebar's "Report an issue" is filled by default; a page
 * with its own primary claims the slot while it shows that button, and the sidebar CTA turns outline.
 * A count, not a flag, so two claimants (or StrictMode's double effects) never clear each other.
 */
let claims = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Call in a page (or the part of it) that shows its own primary button; `active` follows that button. */
export function useClaimPagePrimary(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    claims += 1;
    emit();
    return () => {
      claims -= 1;
      emit();
    };
  }, [active]);
}

/** True while some page on screen has its own primary button. */
export const usePagePrimaryClaimed = () =>
  useSyncExternalStore(
    subscribe,
    () => claims > 0,
    () => false,
  );

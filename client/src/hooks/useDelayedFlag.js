import { useEffect, useState } from "react";

// True only after `active` has stayed true for `delayMs`. Used to show skeletons after 200ms
// so fast responses don't flash a placeholder (docs/UI.md §6 Skeleton).
export function useDelayedFlag(active, delayMs = 200) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);
  return active && elapsed;
}

import { useCallback, useEffect, useState } from "react";

/*
 * A countdown for "Resend the email". start(seconds) begins it; `remaining` counts down to 0 and
 * `label` is the m:ss text ("0:42"). It ticks once a second only while running. The page announces
 * just the end ("You can resend the email now"), not every tick, so screen readers stay quiet.
 */
export function useResendCooldown() {
  const [remaining, setRemaining] = useState(0);

  // One interval for the whole countdown (it is created when it starts, removed when it hits 0).
  const active = remaining > 0;
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const start = useCallback((seconds) => setRemaining(Math.max(0, Math.ceil(seconds))), []);
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  return { remaining, active, label: `${mm}:${ss}`, start };
}

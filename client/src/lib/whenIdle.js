/** Calls `fn` once the browser is idle after first paint (at most 2s later); returns a cancel function. */
export function whenIdle(fn) {
  if (typeof window.requestIdleCallback !== "function") {
    const id = setTimeout(fn, 1);
    return () => clearTimeout(id);
  }
  const id = window.requestIdleCallback(fn, { timeout: 2000 });
  return () => window.cancelIdleCallback(id);
}

import { useEffect, useState } from "react";

// `value`, but only after it has stopped changing for `delayMs`: one request per pause in typing.
export function useDebouncedValue(value, delayMs = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

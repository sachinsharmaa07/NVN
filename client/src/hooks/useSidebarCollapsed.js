import { useCallback, useState } from "react";

// Same "nivaran-" prefix as the theme key. Values: "collapsed" | "expanded".
export const SIDEBAR_STORAGE_KEY = "nivaran-sidebar";

// localStorage can throw (private mode, blocked storage), so every access is guarded.
function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

// [collapsed, toggle]: whether the desktop sidebar shows icons only, remembered between visits.
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((was) => {
      const next = !was;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      } catch {
        // Not saved, but the sidebar still changes for this visit.
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}

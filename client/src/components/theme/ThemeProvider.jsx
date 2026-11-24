import { useCallback, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { THEMES, THEME_STORAGE_KEY, ThemeContext } from "./themeContext";

// Reads the saved choice; storage can throw (private mode), so fall back to "system".
function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);
  // Re-renders when the OS switches between light and dark.
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Keep the class on <html> in sync (index.html set it before first paint).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not saved, but the theme still applies for this visit.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

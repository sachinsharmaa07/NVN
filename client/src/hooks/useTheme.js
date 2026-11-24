import { useContext } from "react";
import { ThemeContext } from "@/components/theme/themeContext";

// { theme: "system" | "light" | "dark", resolvedTheme: "light" | "dark", setTheme(next) }
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}

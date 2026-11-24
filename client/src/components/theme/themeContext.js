import { createContext } from "react";

// Shared between ThemeProvider (writes) and useTheme (reads). Kept in its own file so each
// .jsx file exports only components (keeps React Fast Refresh and its lint rule happy).
export const ThemeContext = createContext(null);

export const THEME_STORAGE_KEY = "nivaran-theme"; // must match the inline script in index.html
export const THEMES = ["system", "light", "dark"];

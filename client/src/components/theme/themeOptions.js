import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

// The three theme choices, shared by the top-bar ThemeMenu (signed out) and the account menu's
// Theme submenu (signed in). The same icon shows on the trigger when that choice is active.
export const THEME_OPTIONS = [
  { value: "system", icon: MonitorIcon, labelKey: "app.theme.system" },
  { value: "light", icon: SunIcon, labelKey: "app.theme.light" },
  { value: "dark", icon: MoonIcon, labelKey: "app.theme.dark" },
];

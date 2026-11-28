import { LazyMenu } from "@/components/system/LazyMenu";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { t } from "@/i18n/t";
import { THEME_OPTIONS as OPTIONS } from "./themeOptions";

const loadDropdown = () => import("./ThemeMenuDropdown");

/*
 * Theme switch in the top bar: match device, light or dark (saved by ThemeProvider).
 * The button shows the icon of the current choice and says it in its name
 * ("Theme: Match device"), so screen reader users know the state before opening the menu.
 * The menu's code loads lazily (LazyMenu); the button is here from the first paint.
 */
export function ThemeMenu() {
  const { theme } = useTheme();
  const current = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[0];
  const Icon = current.icon;
  return (
    <LazyMenu
      load={loadDropdown}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("shell.theme.trigger", { theme: t(current.labelKey) })}
        >
          <Icon aria-hidden="true" className="size-5" />
        </Button>
      }
    />
  );
}

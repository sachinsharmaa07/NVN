import { Link } from "react-router";
import { manageItemsFor } from "@/components/nav/manageItems";
import { THEME_OPTIONS } from "@/components/theme/themeOptions";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useCan } from "@/hooks/useCan";
import { useTheme } from "@/hooks/useTheme";
import { t } from "@/i18n/t";

/** The admin pages this person may open, under a "Manage" label; nothing at all when there are none. */
export function ManageMenuItems() {
  const can = useCan();
  const { level } = useAuth();
  const items = manageItemsFor(can, level);
  if (items.length === 0) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-sm font-medium text-muted-foreground">
          {t("shell.manage.label")}
        </DropdownMenuLabel>
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to}>
              <item.icon aria-hidden="true" />
              {t(item.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </>
  );
}

/** Light / Dark / Match device, for signed-in people (the top bar's theme button is for signed out). */
export function ThemeSubmenu() {
  const { theme, setTheme } = useTheme();
  const current = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <current.icon aria-hidden="true" />
        {t("app.theme.label")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon aria-hidden="true" />
              {t(option.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

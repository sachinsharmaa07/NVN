import { Link } from "react-router";
import { ThemeMenu } from "@/components/theme/ThemeMenu";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { focusRing } from "./navStyles";

/*
 * The app bar at the top of every page, on every screen size (docs/UI.md §5).
 * Left: the wordmark, which links home. Right: the theme menu.
 * The account button and the city name join it when sign-in and pincode lookup exist; we leave
 * them out instead of showing a disabled button that does nothing.
 */
export function TopBar() {
  return (
    <header className="sticky top-0 z-sticky border-b bg-background">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <Link
          to="/"
          aria-label={t("shell.topBar.homeLink")}
          className={cn(
            "-mx-2 inline-flex min-h-11 items-center rounded-md px-2 font-display text-xl font-semibold text-foreground",
            focusRing,
          )}
        >
          {t("app.name")}
        </Link>
        <ThemeMenu />
      </div>
    </header>
  );
}

import { Link } from "react-router";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { ThemeMenu } from "@/components/theme/ThemeMenu";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { focusRing } from "./navStyles";

/*
 * The app bar at the top of every page, on every screen size (docs/UI.md §5).
 * Left: the wordmark, which links home. Right: the theme menu.
 * Right: the theme menu and the account button (Sign in, or the account menu once signed in).
 * The city name joins when pincode lookup exists; we leave it out instead of showing a disabled stub.
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
        <div className="flex items-center gap-1">
          <ThemeMenu />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

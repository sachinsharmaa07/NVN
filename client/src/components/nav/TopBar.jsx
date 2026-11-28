import { Link } from "react-router";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { BrandMark } from "@/components/system/BrandMark";
import { ThemeMenu } from "@/components/theme/ThemeMenu";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";
import { focusRing } from "./navStyles";

/*
 * The app bar at the top of every page, on every screen size (docs/UI.md §5).
 * Left: the brand mark, which links home. Right: the notification bell (signed in only), the theme
 * menu (signed out only; signed in it lives in the account menu) and the account button.
 */
export function TopBar() {
  const { status } = useAuth();
  return (
    <header className="sticky top-0 z-sticky border-b bg-background">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <Link
          to="/"
          aria-label={t("shell.topBar.homeLink")}
          className={cn(
            "-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-foreground",
            focusRing,
          )}
        >
          <BrandMark />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          {status !== "signedIn" && <ThemeMenu />}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

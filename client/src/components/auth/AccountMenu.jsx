import { UserRoundIcon } from "lucide-react";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n/t";

/*
 * Top bar: "Sign in" when signed out, an account menu with "Sign out" when signed in.
 * Shows nothing while Auth0 is still checking (so the button never flashes) and when
 * sign-in is not set up (no button that does nothing).
 */
export function AccountMenu() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "signedOut") {
    return (
      <Button variant="secondary" onClick={() => auth.login(location.pathname + location.search)}>
        {t("auth.account.signIn")}
      </Button>
    );
  }
  if (auth.status !== "signedIn" || !auth.user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("auth.account.menu")}>
          <UserRoundIcon aria-hidden="true" className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-muted-foreground">
            {t("auth.account.signedInAs")}
          </span>
          <span className="block truncate font-medium text-foreground">
            {auth.user.name || auth.user.email}
          </span>
          {auth.user.name && (
            <span className="block truncate text-xs text-muted-foreground">{auth.user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => auth.logout()}>
          {t("auth.account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

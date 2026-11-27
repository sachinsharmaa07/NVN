import {
  Settings2Icon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { AccountAvatar } from "@/components/auth/AccountAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useCan } from "@/hooks/useCan";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useSignInPrompt } from "@/hooks/useSignInPrompt";
import { t } from "@/i18n/t";

// The slot is always 44px wide, so the header does not jump when the answer arrives.
const SLOT = "flex size-11 items-center justify-center";

/*
 * The account slot in the top bar. One state at a time, chosen from auth.status (docs 10.1):
 *   loading      reserved slot, round skeleton after 200ms, "Checking your sign-in" for screen readers
 *   signedOut    "Sign in" (opens the sheet)         unconfigured  nothing
 *   signedIn     avatar menu (+ Admin link for admins)
 *   suspended    menu with Sign out only             error  warning button: Try again / Sign out
 * Until the status is known, nothing that depends on it is shown (no Sign in flash).
 */
export function AccountMenu() {
  const auth = useAuth();
  const can = useCan();
  const location = useLocation();
  const { openSignIn } = useSignInPrompt();
  const showSkeleton = useDelayedFlag(auth.status === "loading");

  if (auth.status === "loading") {
    return (
      <div role="status" className={SLOT}>
        <span className="sr-only">{t("auth.account.loading")}</span>
        {showSkeleton && <Skeleton aria-hidden="true" className="size-10 rounded-full" />}
      </div>
    );
  }
  if (auth.status === "signedOut") {
    return (
      <Button
        variant="secondary"
        onClick={() => openSignIn({ returnTo: location.pathname + location.search })}
      >
        {t("auth.account.signIn")}
      </Button>
    );
  }
  if (auth.status === "suspended") {
    return (
      <Button variant="ghost" onClick={() => auth.logout()}>
        {t("auth.account.signOut")}
      </Button>
    );
  }
  if (auth.status === "error") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("auth.account.unavailable")}>
            <TriangleAlertIcon aria-hidden="true" className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {/* Sign-in without an email can't be fixed by retrying, so only Sign out is offered. */}
          {auth.error?.kind !== "claims" && auth.error?.kind !== "mfa" && (
            <DropdownMenuItem onSelect={() => auth.retry()}>
              {t("auth.account.retry")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => auth.logout()}>
            {t("auth.account.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  if (auth.status !== "signedIn" || !auth.user) return null; // "unconfigured"

  const { user } = auth;
  // "Admin: Users" is for level 2 and up who also hold the permission (both cosmetic checks).
  const showAdmin = auth.level >= 2 && can("user:read_scope");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("auth.account.menu")}
        >
          <AccountAvatar user={user} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-muted-foreground">
            {t("auth.account.signedInAs")}
          </span>
          <span className="block truncate font-medium text-foreground">
            {user.name || user.email}
          </span>
          {user.name && (
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRoundIcon aria-hidden="true" />
            {t("auth.account.profile")}
          </Link>
        </DropdownMenuItem>
        {showAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin/users">
              <UsersIcon aria-hidden="true" />
              {t("auth.account.adminUsers")}
            </Link>
          </DropdownMenuItem>
        )}
        {auth.level >= 2 && can("user:promote") && (
          <DropdownMenuItem asChild>
            <Link to="/admin/city-settings">
              <Settings2Icon aria-hidden="true" />
              {t("auth.account.citySettings")}
            </Link>
          </DropdownMenuItem>
        )}
        {can("post:moderate") && (
          <DropdownMenuItem asChild>
            <Link to="/moderation">
              <ShieldCheckIcon aria-hidden="true" />
              {t("auth.account.moderation")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => auth.logout()}>
          {t("auth.account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

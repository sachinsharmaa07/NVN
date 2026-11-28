import { UserRoundIcon } from "lucide-react";
import { Link } from "react-router";
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
import { ManageMenuItems, ThemeSubmenu } from "./AccountMenuSections";

/**
 * The account menus, loaded lazily by AccountMenu (components/system/LazyMenu.jsx).
 * kind "signedIn": Profile, Theme, Manage (what this person may open), Sign out.
 * kind "error": Try again (unless retrying cannot help) and Sign out.
 */
export default function AccountMenuDropdown({ trigger, defaultOpen, kind }) {
  const auth = useAuth();
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {kind === "error" ? <ErrorItems auth={auth} /> : <SignedInItems auth={auth} />}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ErrorItems({ auth }) {
  return (
    <>
      {/* Sign-in without an email can't be fixed by retrying, so only Sign out is offered. */}
      {auth.error?.kind !== "claims" && auth.error?.kind !== "mfa" && (
        <DropdownMenuItem onSelect={() => auth.retry()}>{t("auth.account.retry")}</DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={() => auth.logout()}>
        {t("auth.account.signOut")}
      </DropdownMenuItem>
    </>
  );
}

function SignedInItems({ auth }) {
  const { user } = auth;
  if (!user) return null;
  return (
    <>
      <DropdownMenuLabel className="font-normal">
        <span className="block text-xs text-muted-foreground">{t("auth.account.signedInAs")}</span>
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
      <ThemeSubmenu />
      <ManageMenuItems />
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => auth.logout()}>
        {t("auth.account.signOut")}
      </DropdownMenuItem>
    </>
  );
}

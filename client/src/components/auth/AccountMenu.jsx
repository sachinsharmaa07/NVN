import { TriangleAlertIcon } from "lucide-react";
import { useLocation } from "react-router";
import { AccountAvatar } from "@/components/auth/AccountAvatar";
import { LazyMenu } from "@/components/system/LazyMenu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useSignInPrompt } from "@/hooks/useSignInPrompt";
import { t } from "@/i18n/t";

// The menus' code loads lazily (LazyMenu); the triggers are here from the first paint.
const loadDropdown = () => import("./AccountMenuDropdown");

// The slot is always 44px wide, so the header does not jump when the answer arrives.
const SLOT = "flex size-11 items-center justify-center";

/*
 * The account slot in the top bar. One state at a time, chosen from auth.status (docs 10.1):
 *   loading      reserved slot, round skeleton after 200ms, "Checking your sign-in" for screen readers
 *   signedOut    "Sign in" (opens the sheet)         unconfigured  nothing
 *   signedIn     avatar menu: Profile, Theme, Manage (what this person may open), Sign out
 *   suspended    menu with Sign out only             error  warning button: Try again / Sign out
 * Until the status is known, nothing that depends on it is shown (no Sign in flash).
 */
export function AccountMenu() {
  const auth = useAuth();
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
      <LazyMenu
        load={loadDropdown}
        kind="error"
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("auth.account.unavailable")}>
            <TriangleAlertIcon aria-hidden="true" className="size-5" />
          </Button>
        }
      />
    );
  }
  if (auth.status !== "signedIn" || !auth.user) return null; // "unconfigured"

  return (
    <LazyMenu
      load={loadDropdown}
      kind="signedIn"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("auth.account.menu")}
        >
          <AccountAvatar user={auth.user} />
        </Button>
      }
    />
  );
}

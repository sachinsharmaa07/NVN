import { LockIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import { toast } from "sonner";
import { ForbiddenView } from "@/components/auth/ForbiddenView";
import { EmptyState } from "@/components/system/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useCan } from "@/hooks/useCan";
import { useSignInPrompt } from "@/hooks/useSignInPrompt";
import { t } from "@/i18n/t";

const frame = "mx-auto flex w-full max-w-160 flex-col px-4 py-12 md:px-6 lg:px-8";

/*
 * Wrap a page's element to decide who may see it:
 *   <RequireAuth>...</RequireAuth>                         signed in
 *   <RequireAuth verified>...</RequireAuth>                + verified email (else sign-in sheet)
 *   <RequireAuth permission="user:read_scope">             + holds that permission
 *   <RequireAuth minLevel={2}>                             + role level 2 or higher
 * Checked top to bottom (docs/phase-1-auth.md 10.3). This only decides what to SHOW.
 * The server checks the same rules on every request.
 */
export function RequireAuth({ children, verified = false, permission, minLevel }) {
  const auth = useAuth();
  const can = useCan();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  // 1. Still finding out who this is: show a page-shaped skeleton, never the page.
  if (auth.status === "loading") {
    return (
      <div className={frame} role="status" aria-busy="true">
        <span className="sr-only">{t("auth.guard.loading")}</span>
        <Skeleton aria-hidden="true" className="h-40 w-full" />
      </div>
    );
  }
  if (auth.status === "unconfigured") {
    return (
      <div className={frame}>
        <EmptyState
          icon={TriangleAlertIcon}
          title={t("auth.guard.unconfiguredTitle")}
          hint={t("auth.guard.unconfiguredHint")}
        />
      </div>
    );
  }
  if (auth.status === "signedOut") {
    return (
      <div className={frame}>
        <EmptyState
          icon={LockIcon}
          title={t("auth.guard.title")}
          hint={t("auth.guard.hint")}
          action={<Button onClick={() => auth.login(returnTo)}>{t("auth.account.signIn")}</Button>}
        />
      </div>
    );
  }
  if (auth.status === "suspended") return <Navigate to="/suspended" replace />;
  if (auth.status === "error") {
    return (
      <div className={frame}>
        <EmptyState
          icon={TriangleAlertIcon}
          title={t("auth.guard.errorTitle")}
          hint={auth.error?.message || t("auth.guard.errorHint")}
          action={
            auth.error?.kind === "claims" || auth.error?.kind === "mfa" ? (
              <Button variant="secondary" onClick={() => auth.logout()}>
                {t("auth.account.signOut")}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => auth.retry()}>
                {t("auth.guard.retry")}
              </Button>
            )
          }
        />
      </div>
    );
  }
  if (verified && !auth.user.emailVerified) {
    return <UnverifiedGate returnTo={returnTo} />;
  }
  // 403 in place: the URL stays, so Back works.
  if ((permission && !can(permission)) || (minLevel && (auth.level ?? 0) < minLevel)) {
    return <ForbiddenView />;
  }
  return children;
}

/* No verification link any more: signing in again (Google or email OTP) yields a verified email. */
function UnverifiedGate({ returnTo }) {
  const { openSignIn } = useSignInPrompt();
  useEffect(() => {
    toast.error(t("errors.auth.emailNotVerified"));
    openSignIn({ returnTo, variant: "gated" });
  }, [openSignIn, returnTo]);
  return (
    <div className={frame}>
      <EmptyState
        icon={LockIcon}
        title={t("auth.guard.unverifiedTitle")}
        hint={t("errors.auth.emailNotVerified")}
        action={
          <Button onClick={() => openSignIn({ returnTo, variant: "gated" })}>
            {t("auth.account.signIn")}
          </Button>
        }
      />
    </div>
  );
}

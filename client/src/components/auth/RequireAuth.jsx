import { LockIcon, TriangleAlertIcon } from "lucide-react";
import { Navigate, useLocation } from "react-router";
import { EmptyState } from "@/components/system/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n/t";

const frame = "mx-auto flex w-full max-w-160 flex-col px-4 py-12 md:px-6 lg:px-8";

/*
 * Wrap a page's element to keep signed-out visitors out of it:
 *   <RequireAuth>...</RequireAuth>           signed in
 *   <RequireAuth verified>...</RequireAuth>  signed in with a verified email
 * This only decides what to SHOW. The server checks the same rules on every request.
 */
export function RequireAuth({ children, verified = false }) {
  const auth = useAuth();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  if (auth.status === "loading") {
    return (
      <div className={frame} role="status" aria-busy="true">
        <span className="sr-only">{t("auth.guard.loading")}</span>
        <Skeleton className="h-40 w-full" />
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
  if (auth.status === "error") {
    return (
      <div className={frame}>
        <EmptyState
          icon={TriangleAlertIcon}
          title={t("auth.guard.errorTitle")}
          hint={auth.error?.message || t("auth.guard.errorHint")}
          action={
            <Button variant="secondary" onClick={() => auth.refresh()}>
              {t("auth.guard.retry")}
            </Button>
          }
        />
      </div>
    );
  }
  if (verified && !auth.user.emailVerified) {
    return <Navigate to="/verify-email" replace state={{ returnTo }} />;
  }
  return children;
}

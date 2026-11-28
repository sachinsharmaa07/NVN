import { BanIcon } from "lucide-react";
import { useEffect } from "react";
import { Navigate } from "react-router";
import { EmptyState } from "@/components/system/EmptyState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n/t";
import { SUPPORT_CONTACT } from "@/lib/authConfig";

// Shown only to suspended users: why, who to contact, and Sign out. An active user (or a visitor)
// who lands here by typing the address is sent home. While we are still checking, show nothing.
export function Suspended() {
  const { status, suspendedReason, logout } = useAuth();

  useEffect(() => {
    if (status === "suspended") document.getElementById("main")?.focus();
  }, [status]);

  if (status === "loading") return null;
  if (status !== "suspended") return <Navigate to="/" replace />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-12 *:max-w-160 md:px-6 lg:px-8">
      <EmptyState
        icon={BanIcon}
        titleAs="h1"
        title={t("auth.suspended.title")}
        hint={
          <>
            {suspendedReason
              ? t("auth.suspended.reason", { reason: suspendedReason })
              : t("auth.suspended.noReason")}
            <br />
            {t("auth.suspended.contact", { contact: SUPPORT_CONTACT })}
          </>
        }
        action={
          <Button variant="secondary" onClick={() => logout()}>
            {t("auth.suspended.signOut")}
          </Button>
        }
      />
    </div>
  );
}

export default Suspended;

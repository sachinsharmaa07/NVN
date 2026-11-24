import { MailCheckIcon } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n/t";
import { request } from "@/lib/api";
import { safePath } from "@/lib/safePath";

function VerifyEmailContent() {
  const auth = useAuth();
  const navigate = useNavigate();
  const returnTo = safePath(useLocation().state?.returnTo);
  const [busy, setBusy] = useState(null); // "check" | "resend" | null
  const [message, setMessage] = useState("");

  // Already verified (maybe in another tab): nothing to do here.
  if (auth.user.emailVerified) return <Navigate to={returnTo} replace />;

  async function check() {
    setBusy("check");
    setMessage("");
    try {
      const fresh = await auth.refresh();
      if (fresh?.emailVerified) return navigate(returnTo, { replace: true });
      setMessage(t("auth.verify.stillUnverified"));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    setBusy("resend");
    setMessage("");
    try {
      await request("/api/me/resend-verification", {
        method: "POST",
        body: {},
        headers: await auth.getAuthHeaders(),
      });
      setMessage(t("auth.verify.resent"));
    } catch (error) {
      setMessage(error.message); // the server's own words, e.g. why it can't resend yet
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader
        title={t("auth.verify.title")}
        description={t("auth.verify.description", { email: auth.user.email })}
      />
      <div className="flex flex-col items-start gap-4">
        <MailCheckIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={check} disabled={busy !== null}>
            {busy === "check" ? t("auth.verify.checking") : t("auth.verify.check")}
          </Button>
          <Button variant="secondary" onClick={resend} disabled={busy !== null}>
            {busy === "resend" ? t("auth.verify.resending") : t("auth.verify.resend")}
          </Button>
        </div>
        {/* aria-live reads the result out to screen reader users without moving focus */}
        <p role="status" className="min-h-6 text-sm text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  );
}

export function VerifyEmail() {
  return (
    <RequireAuth>
      <VerifyEmailContent />
    </RequireAuth>
  );
}

export default VerifyEmail;

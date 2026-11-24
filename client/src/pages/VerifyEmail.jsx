import { MailCheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import { useResendVerification } from "@/hooks/useResendVerification";
import { t } from "@/i18n/t";
import { messageForCode } from "@/lib/apiErrors";
import { safePath } from "@/lib/safePath";

// How long to wait before offering "Resend" again (docs 10.1): normally 60 s, 10 s after an outage.
const COOLDOWN_SECONDS = 60;
const OUTAGE_COOLDOWN_SECONDS = 10;

function VerifyEmailContent() {
  const auth = useAuth();
  const navigate = useNavigate();
  const returnTo = safePath(useLocation().state?.returnTo);
  const resend = useResendVerification();
  const cooldown = useResendCooldown();
  const [checking, setChecking] = useState(false);
  // One status line for every result: { text, isError }. role="status" announces it politely.
  const [result, setResult] = useState({ text: "", isError: false });
  const wasCoolingDown = useRef(false);

  // Tell screen-reader users once when the wait is over (not on every tick).
  useEffect(() => {
    if (cooldown.active) wasCoolingDown.current = true;
    else if (wasCoolingDown.current) {
      wasCoolingDown.current = false;
      setResult({ text: t("auth.verify.cooldownDone"), isError: false });
    }
  }, [cooldown.active]);

  // Already verified (maybe in another tab): nothing to do here.
  if (auth.user.emailVerified) return <Navigate to={returnTo} replace />;

  async function check() {
    setChecking(true);
    setResult({ text: "", isError: false });
    try {
      // A brand-new token is needed: the old one still says "email not verified".
      const fresh = await auth.refresh();
      if (fresh?.emailVerified) return navigate(returnTo, { replace: true });
      setResult({ text: t("auth.verify.stillUnverified"), isError: false });
    } catch (error) {
      setResult({ text: error.message, isError: true });
    } finally {
      setChecking(false);
    }
  }

  async function sendAgain() {
    setResult({ text: "", isError: false });
    try {
      await resend.mutateAsync();
      cooldown.start(COOLDOWN_SECONDS);
      setResult({ text: t("auth.verify.resent"), isError: false });
    } catch (error) {
      if (error.code === "ALREADY_VERIFIED") {
        // Verified in the meantime: pick up the new token, then carry on.
        setResult({ text: messageForCode("ALREADY_VERIFIED"), isError: false });
        const fresh = await auth.refresh().catch(() => null);
        if (fresh?.emailVerified) navigate(returnTo, { replace: true });
        return;
      }
      if (error.code === "RATE_LIMITED") cooldown.start(error.retryAfter ?? COOLDOWN_SECONDS);
      if (error.code === "AUTH_PROVIDER_UNAVAILABLE") cooldown.start(OUTAGE_COOLDOWN_SECONDS);
      setResult({ text: error.message, isError: true });
    }
  }

  const busy = checking || resend.isPending;
  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader
        title={t("auth.verify.title")}
        description={t("auth.verify.description", { email: auth.user.email })}
      />
      <div className="flex flex-col items-start gap-4">
        <MailCheckIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={check} loading={checking} disabled={busy}>
            {checking ? t("auth.verify.checking") : t("auth.verify.check")}
          </Button>
          <Button
            variant="secondary"
            onClick={sendAgain}
            loading={resend.isPending}
            disabled={busy || cooldown.active}
          >
            {cooldown.active ? (
              // tabular-nums keeps the digits the same width so the button does not jiggle.
              <span className="tabular-nums">
                {t("auth.verify.resendIn", { time: cooldown.label })}
              </span>
            ) : resend.isPending ? (
              t("auth.verify.resending")
            ) : (
              t("auth.verify.resend")
            )}
          </Button>
        </div>
        <p
          role={result.isError ? "alert" : "status"}
          className={`min-h-6 text-sm ${result.isError ? "text-destructive" : "text-muted-foreground"}`}
        >
          {result.text}
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

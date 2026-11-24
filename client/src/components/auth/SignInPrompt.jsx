import { ResponsiveDialog } from "@/components/system/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n/t";
import { EMAIL_CONNECTION, GOOGLE_CONNECTION } from "@/lib/authConfig";
import { safePath } from "@/lib/safePath";

// Which wording each opener gets: the header button, a gated action, or an ended session.
const COPY = {
  default: { title: "auth.signIn.title", body: "auth.signIn.body" },
  gated: { title: "auth.signIn.titleGated", body: "auth.signIn.body" },
  expired: { title: "auth.signIn.titleExpired", body: "auth.signIn.bodyExpired" },
};

/*
 * The sign-in sheet: a bottom drawer on phones, a dialog on desktop. Both buttons start the
 * Auth0 redirect and come back to `returnTo` (cleaned by safePath so it can only be a page on
 * this site). Google is the primary choice; email and password is the quiet second one.
 */
export function SignInPrompt({ open, onOpenChange, returnTo = "/", variant = "default" }) {
  const auth = useAuth();
  const copy = COPY[variant] ?? COPY.default;
  const go = (connection) => auth.login(safePath(returnTo), { connection });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(copy.title)}
      description={t(copy.body)}
      footer={
        <>
          <Button size="lg" onClick={() => go(GOOGLE_CONNECTION)}>
            {t("auth.signIn.google")}
          </Button>
          <Button size="lg" variant="outline" onClick={() => go(EMAIL_CONNECTION)}>
            {t("auth.signIn.email")}
          </Button>
        </>
      }
    />
  );
}

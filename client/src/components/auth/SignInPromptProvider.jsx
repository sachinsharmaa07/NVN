import { useCallback, useMemo, useState } from "react";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import { SignInPromptContext } from "@/components/auth/signInPromptContext";
import { useAuth } from "@/hooks/useAuth";

/*
 * Mounts ONE sign-in sheet for the whole app and lets anything open it:
 *   const { openSignIn } = useSignInPrompt(); openSignIn({ returnTo: "/report", variant: "gated" })
 * When the session ends (status signedOut with reason sessionExpired) it is open by itself in the
 * "expired" wording until the user closes it. Form drafts stay in their components, so nothing
 * the user typed is lost.
 */
export function SignInPromptProvider({ children }) {
  const { status, reason } = useAuth();
  const [state, setState] = useState({ open: false, returnTo: "/", variant: "default" });
  const [expiredDismissed, setExpiredDismissed] = useState(false);

  const openSignIn = useCallback(
    ({ returnTo = "/", variant = "default" } = {}) => setState({ open: true, returnTo, variant }),
    [],
  );
  const onOpenChange = useCallback((open) => {
    setState((s) => ({ ...s, open }));
    if (!open) setExpiredDismissed(true);
  }, []);

  // Derived, not stored: no effect needed. A manual opener wins over the automatic expired one.
  const expired = status === "signedOut" && reason === "sessionExpired" && !expiredDismissed;
  const shown = state.open
    ? state
    : {
        open: expired,
        variant: "expired",
        returnTo: window.location.pathname + window.location.search,
      };

  const value = useMemo(() => ({ openSignIn }), [openSignIn]);
  return (
    <SignInPromptContext.Provider value={value}>
      {children}
      <SignInPrompt {...shown} onOpenChange={onOpenChange} />
    </SignInPromptContext.Provider>
  );
}

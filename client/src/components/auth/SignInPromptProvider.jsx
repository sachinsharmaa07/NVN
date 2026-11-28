import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { SignInPromptContext } from "@/components/auth/signInPromptContext";
import { whenIdle } from "@/lib/whenIdle";
import { useAuth } from "@/hooks/useAuth";

// The sheet's code (dialog, drawer) is not in the first download (HLD §7): it loads when the browser is
// idle, or on the first open, and mounts from then on so it can animate closed.
const loadPrompt = () => import("@/components/auth/SignInPrompt");
const SignInPrompt = lazy(() => loadPrompt().then((mod) => ({ default: mod.SignInPrompt })));

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

  const [mounted, setMounted] = useState(false);
  if (shown.open && !mounted) setMounted(true);
  useEffect(() => whenIdle(loadPrompt), []);

  const value = useMemo(() => ({ openSignIn }), [openSignIn]);
  return (
    <SignInPromptContext.Provider value={value}>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          <SignInPrompt {...shown} onOpenChange={onOpenChange} />
        </Suspense>
      )}
    </SignInPromptContext.Provider>
  );
}

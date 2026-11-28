import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ME_KEY, useMeQuery } from "@/hooks/useMe";
import { t } from "@/i18n/t";
import { SUPPORT_CONTACT, authConfig } from "@/lib/authConfig";
import { claimMfaAttempt, clearMfaAttempt, mfaAttempted } from "@/lib/mfaGuard";
import { levelOf } from "@/lib/roles";
import { safePath } from "@/lib/safePath";
import { router } from "./router";

/*
 * The Auth0 half of AuthProvider, in its own lazy chunk (UI.md §5.2: the SDK is ~68 KB gzip and the first
 * paint doesn't need it). Tokens stay in memory only (never localStorage). Refresh tokens keep you signed
 * in; if the browser has none, Auth0 falls back to a hidden iframe using its own session cookie.
 * It renders nothing: AuthBridge works out "who is signed in" and hands it to AuthProvider via onChange.
 */
export function Auth0Session({ onChange }) {
  return (
    <Auth0Provider
      domain={authConfig.domain}
      clientId={authConfig.clientId}
      cacheLocation="memory"
      useRefreshTokens
      useRefreshTokensFallback
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: authConfig.audience,
        // offline_access is what makes Auth0 hand out a refresh token.
        scope: "openid profile email offline_access",
      }}
      // After Auth0 sends you back, go to the page you were trying to reach.
      onRedirectCallback={(appState) =>
        router.navigate(safePath(appState?.returnTo), { replace: true })
      }
    >
      <AuthBridge onChange={onChange} />
    </Auth0Provider>
  );
}

// How the failure should be explained: "mfa" (stuck, sign out), "claims" (sign out and in),
// "network" (retry), "session" (sign in again), "server" (retry).
function errorKind(auth0Error, meError) {
  if (meError?.code === "MFA_REQUIRED") return "mfa";
  if (meError?.code === "TOKEN_CLAIMS_MISSING") return "claims";
  if (meError?.code === "NETWORK_ERROR" || meError?.code === "TIMEOUT") return "network";
  if (auth0Error) return "session";
  return "server";
}

// A 401 that is not "your token has no email" means the session itself is over.
const isSessionEnd = (e) => e?.status === 401 && e.code !== "TOKEN_CLAIMS_MISSING";

function AuthBridge({ onChange }) {
  const { isLoading, isAuthenticated, error, loginWithRedirect, logout, getAccessTokenSilently } =
    useAuth0();
  const queryClient = useQueryClient();
  // Set when an API call proves the session is over (401 after one silent retry).
  const [expired, setExpired] = useState(false);
  // Did we already send this tab to Auth0 for two-step verification? Read once, at page load.
  const [mfaTried] = useState(() => mfaAttempted());

  const getAuthHeaders = useCallback(
    async (options) => ({ Authorization: `Bearer ${await getAccessTokenSilently(options)}` }),
    [getAccessTokenSilently],
  );

  const me = useMeQuery({ getAuthHeaders, enabled: isAuthenticated && !expired });
  const { refetch } = me;
  const sessionEnded = expired || (isAuthenticated && isSessionEnd(me.error));

  // The redirect to Auth0 for a page to come back to; `connection` picks Google or email,
  // `prompt: "login"` forces a fresh sign-in.
  const startLogin = useCallback(
    (returnTo = "/", { connection, prompt } = {}) =>
      loginWithRedirect({
        appState: { returnTo: safePath(returnTo) },
        authorizationParams: { ...(connection && { connection }), ...(prompt && { prompt }) },
      }),
    [loginWithRedirect],
  );
  const login = useCallback(
    (returnTo, options) => {
      setExpired(false); // a new sign-in starts a new session
      return startLogin(returnTo, options);
    },
    [startLogin],
  );

  // Asks Auth0 for a brand-new token (the old one still says "email not verified"), then reloads
  // /me. A failed reload is thrown, so the caller can show the real reason.
  const refresh = useCallback(async () => {
    await getAccessTokenSilently({ cacheMode: "off" });
    setExpired(false); // Auth0 gave us a token, so the session is alive
    const result = await refetch();
    if (result.error) throw result.error;
    return result.data;
  }, [getAccessTokenSilently, refetch]);

  const mfaRequired = me.error?.code === "MFA_REQUIRED";
  useEffect(() => {
    // The server wants two-step verification this session did not use: sign in again from
    // scratch, but only ONCE per tab. After that status "error" (kind "mfa") takes over.
    if (mfaRequired && !mfaTried && claimMfaAttempt()) {
      startLogin(window.location.pathname + window.location.search, { prompt: "login" });
    }
  }, [mfaRequired, mfaTried, startLogin]);

  // /api/me worked: forget an old attempt (a fresh one stays for a short while, see mfaGuard).
  const meOk = me.isSuccess;
  useEffect(() => {
    if (meOk) clearMfaAttempt();
  }, [meOk]);

  // "Try again" on the error screens: only what makes sense for the kind of failure.
  const retry = useCallback(async () => {
    try {
      if (!isAuthenticated || isSessionEnd(me.error)) {
        await login(window.location.pathname + window.location.search);
      } else {
        await refetch();
      }
    } catch {
      /* the error stays on screen; nothing else to do */
    }
  }, [isAuthenticated, me.error, login, refetch]);

  // Order matters: the first matching line wins (the rule table is in docs/phase-1-auth.md 10.3).
  let status = "signedIn";
  if (isLoading || (isAuthenticated && !sessionEnded && me.isPending)) status = "loading";
  else if (!isAuthenticated || sessionEnded) status = error ? "error" : "signedOut";
  else if (me.error?.code === "SUSPENDED" || me.data?.status === "suspended") status = "suspended";
  else if (me.isError) status = "error";

  const user = status === "signedIn" ? (me.data ?? null) : null;
  const suspendedReason = me.error?.details?.reason ?? me.data?.suspendedReason ?? "";

  const value = useMemo(() => {
    const kind = status === "error" ? errorKind(error, me.error) : null;
    return {
      status,
      reason: status === "signedOut" && sessionEnded ? "sessionExpired" : undefined,
      user,
      level: user ? (user.level ?? levelOf(user.role)) : 0,
      isVerified: Boolean(user?.emailVerified),
      suspendedReason,
      error: kind && {
        kind,
        message:
          kind === "mfa"
            ? t("errors.auth.mfaBlocked", { contact: SUPPORT_CONTACT })
            : (me.error?.message ?? error?.message),
      },
      login,
      logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
      refresh,
      retry,
      getAuthHeaders,
      expireSession: () => setExpired(true),
      // useApi calls these when the server's answer disagrees with what we cached.
      markSuspended: (reason = "") =>
        queryClient.setQueryData(ME_KEY, (old) => ({
          ...old,
          status: "suspended",
          suspendedReason: reason,
        })),
      markUnverified: () =>
        queryClient.setQueryData(ME_KEY, (old) => old && { ...old, emailVerified: false }),
    };
  }, [
    status,
    sessionEnded,
    user,
    suspendedReason,
    error,
    me.error,
    login,
    logout,
    refresh,
    retry,
    getAuthHeaders,
    queryClient,
  ]);

  // AuthProvider owns the context (so the app never remounts); this only reports the value up.
  useEffect(() => onChange(value), [onChange, value]);
  return null;
}

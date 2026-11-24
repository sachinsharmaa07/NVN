import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { AuthContext } from "@/components/auth/authContext";
import { apiGet } from "@/lib/api";
import { authConfig } from "@/lib/authConfig";
import { safePath } from "@/lib/safePath";
import { router } from "./router";

/*
 * Wraps the app with Auth0 and puts our own simple "who is signed in" value in AuthContext.
 * Pages never import Auth0 directly: they call useAuth(), so tests and the no-Auth0 mode work.
 * Tokens stay in memory only (never localStorage). Refresh tokens keep you signed in; if the
 * browser has none, Auth0 falls back to a hidden iframe using its own session cookie.
 */
export function AuthProvider({ children }) {
  if (!authConfig) {
    return (
      <AuthContext.Provider value={{ status: "unconfigured", user: null }}>
        {children}
      </AuthContext.Provider>
    );
  }
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
      }}
      // After Auth0 sends you back, go to the page you were trying to reach.
      onRedirectCallback={(appState) =>
        router.navigate(safePath(appState?.returnTo), { replace: true })
      }
    >
      <AuthBridge>{children}</AuthBridge>
    </Auth0Provider>
  );
}

function AuthBridge({ children }) {
  const { isLoading, isAuthenticated, error, loginWithRedirect, logout, getAccessTokenSilently } =
    useAuth0();

  const getAuthHeaders = useCallback(
    async (options) => ({ Authorization: `Bearer ${await getAccessTokenSilently(options)}` }),
    [getAccessTokenSilently],
  );

  // Our own record of the user (role, city, verified). The first call after sign-in creates it.
  const me = useQuery({
    queryKey: ["me"],
    enabled: isAuthenticated,
    queryFn: async ({ signal }) =>
      (await apiGet("/api/me", { signal, headers: await getAuthHeaders() })).user,
  });
  const { refetch } = me;

  // Asks Auth0 for a brand-new token (the old one still says "email not verified"), then reloads /me.
  const refresh = useCallback(async () => {
    await getAccessTokenSilently({ cacheMode: "off" });
    return (await refetch()).data;
  }, [getAccessTokenSilently, refetch]);

  let status = "signedIn";
  if (isLoading || (isAuthenticated && me.isPending)) status = "loading";
  else if (!isAuthenticated && !error) status = "signedOut";
  else if (error || me.isError) status = "error";

  const value = useMemo(
    () => ({
      status,
      user: me.data ?? null,
      error: error ?? me.error ?? null,
      login: (returnTo = "/") => loginWithRedirect({ appState: { returnTo: safePath(returnTo) } }),
      logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
      refresh,
      getAuthHeaders,
    }),
    [status, me.data, me.error, error, loginWithRedirect, logout, refresh, getAuthHeaders],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

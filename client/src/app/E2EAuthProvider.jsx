import { useCallback, useMemo } from "react";
import { AuthContext } from "@/components/auth/authContext";
import { useMeQuery } from "@/hooks/useMe";
import { levelOf } from "@/lib/roles";

const E2E_TOKEN = "e2e-test-token"; // fake: the Playwright fixtures answer every /api call

/*
 * ADR 0003. Only used when VITE_E2E=1 (dev server under Playwright; vite.config.js refuses to build
 * with it). No Auth0: a fixed fake token, and the user comes from GET /api/me like in production, so
 * pages, useApi and RequireAuth run unchanged. Same value shape as AuthProvider's AuthBridge.
 */
export function E2EAuthProvider({ children }) {
  const getAuthHeaders = useCallback(async () => ({ Authorization: `Bearer ${E2E_TOKEN}` }), []);
  const me = useMeQuery({ getAuthHeaders, enabled: true });
  const status = me.isPending ? "loading" : me.isError ? "error" : "signedIn";
  const user = status === "signedIn" ? me.data : null;

  const value = useMemo(() => {
    const noop = async () => {};
    return {
      status,
      user,
      level: user ? (user.level ?? levelOf(user.role)) : 0,
      isVerified: Boolean(user?.emailVerified),
      suspendedReason: "",
      error: status === "error" ? { kind: "server", message: me.error?.message } : null,
      login: noop,
      logout: noop,
      refresh: async () => user,
      retry: noop,
      getAuthHeaders,
      expireSession: noop,
      markSuspended: noop,
      markUnverified: noop,
    };
  }, [status, user, me.error, getAuthHeaders]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

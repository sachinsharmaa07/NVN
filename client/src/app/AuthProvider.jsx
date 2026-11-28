import { useEffect, useState } from "react";
import { AuthContext } from "@/components/auth/authContext";
import { t } from "@/i18n/t";
import { authConfig } from "@/lib/authConfig";
import { E2EAuthProvider } from "./E2EAuthProvider";

/*
 * Puts our own simple "who is signed in" value in AuthContext. Pages never import Auth0 directly: they call
 * useAuth(), so tests and the no-Auth0 mode work. The Auth0 SDK itself lives in Auth0Session, a lazy chunk.
 */
export function AuthProvider({ children }) {
  // Playwright only (ADR 0003). A literal comparison, so a normal build drops this branch entirely.
  if (import.meta.env.VITE_E2E === "1") return <E2EAuthProvider>{children}</E2EAuthProvider>;
  if (!authConfig) {
    return (
      <AuthContext.Provider value={{ status: "unconfigured", user: null }}>
        {children}
      </AuthContext.Provider>
    );
  }
  return <LazyAuth0>{children}</LazyAuth0>;
}

const noop = async () => {};

// While the SDK chunk loads, auth is "loading", exactly as it is while Auth0 checks the session. A request
// made in that window waits for the real getAuthHeaders instead of going out without a token.
function loadingValue(session) {
  return {
    status: "loading",
    user: null,
    level: 0,
    isVerified: false,
    suspendedReason: "",
    error: null,
    login: (...args) => session.then((v) => v.login(...args)),
    logout: noop,
    refresh: (...args) => session.then((v) => v.refresh(...args)),
    retry: noop,
    getAuthHeaders: (...args) => session.then((v) => v.getAuthHeaders(...args)),
    expireSession: noop,
    markSuspended: noop,
    markUnverified: noop,
  };
}

// The chunk didn't arrive (offline on first load): say so, and Try again reloads the page.
const failedValue = () => ({
  ...loadingValue(new Promise(() => {})),
  status: "error",
  error: { kind: "network", message: t("errors.common.network") },
  retry: async () => window.location.reload(),
});

function LazyAuth0({ children }) {
  // The first value Auth0Session reports settles `session`, so early callers get the real functions.
  const [first] = useState(() => {
    let resolve;
    const session = new Promise((r) => (resolve = r));
    return { session, resolve };
  });
  const [value, setValue] = useState(() => loadingValue(first.session));
  const [Session, setSession] = useState(null);

  useEffect(() => {
    let live = true;
    import("./Auth0Session").then(
      (m) => live && setSession(() => m.Auth0Session),
      () => live && setValue(failedValue()),
    );
    return () => {
      live = false;
    };
  }, []);

  const [onChange] = useState(() => (next) => {
    first.resolve(next);
    setValue(next);
  });

  // The Provider keeps the same place in the tree before and after the SDK loads, so the app never remounts.
  return (
    <>
      {Session && <Session onChange={onChange} />}
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </>
  );
}

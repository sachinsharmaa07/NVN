import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { fakeFetch } from "@/test/renderWithAuth";
import { AuthProvider } from "./AuthProvider";

// Only the Auth0 SDK, the router and the env-based config are faked. Our own code runs for real.
const auth0 = vi.hoisted(() => ({ value: {} }));
vi.mock("@auth0/auth0-react", () => ({
  Auth0Provider: ({ children }) => children,
  useAuth0: () => auth0.value,
}));
vi.mock("./router", () => ({ router: { navigate: vi.fn() } }));
vi.mock("@/lib/authConfig", () => ({
  authConfig: { domain: "d", clientId: "c", audience: "a" },
  SUPPORT_CONTACT: "your city admin",
  GOOGLE_CONNECTION: "google-oauth2",
  EMAIL_CONNECTION: "db",
}));

function setAuth0(extra = {}) {
  auth0.value = {
    isLoading: false,
    isAuthenticated: true,
    error: undefined,
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn(async () => "tok"),
    ...extra,
  };
  return auth0.value;
}

function Probe() {
  const a = useAuth();
  const me = useMe();
  return (
    <>
      <p data-testid="status">{a.status}</p>
      <p data-testid="reason">{a.reason ?? ""}</p>
      <p data-testid="kind">{a.error?.kind ?? ""}</p>
      <p data-testid="reason-text">{a.suspendedReason}</p>
      <p data-testid="me">{me.user?.email ?? ""}</p>
      <button onClick={() => a.retry()}>retry</button>
    </>
  );
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}
const status = () => screen.getByTestId("status").textContent;
const err = (code, httpStatus, details) => [httpStatus, { error: { code, message: "x", details } }];
const meUser = { id: "u1", email: "asha@example.com", role: "citizen", emailVerified: true };

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("AuthProvider status", () => {
  it("Auth0 still loading -> loading", () => {
    setAuth0({ isLoading: true, isAuthenticated: false });
    vi.stubGlobal("fetch", fakeFetch({}));
    mount();
    expect(status()).toBe("loading");
  });

  it("signed in but /api/me still pending -> loading, never signedOut", async () => {
    setAuth0();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    ); // never answers
    mount();
    await act(async () => {});
    expect(status()).toBe("loading");
    expect(screen.getByTestId("me").textContent).toBe("");
  });

  it("not signed in -> signedOut", () => {
    setAuth0({ isAuthenticated: false });
    mount();
    expect(status()).toBe("signedOut");
  });

  it("/api/me ok -> signedIn with the user (useMe)", async () => {
    setAuth0();
    vi.stubGlobal("fetch", fakeFetch({ "/api/me": [200, { user: meUser }] }));
    mount();
    await waitFor(() => expect(status()).toBe("signedIn"));
    expect(screen.getByTestId("me").textContent).toBe("asha@example.com");
  });

  it("403 SUSPENDED -> suspended, with the reason", async () => {
    setAuth0();
    vi.stubGlobal("fetch", fakeFetch({ "/api/me": err("SUSPENDED", 403, { reason: "Spam" }) }));
    mount();
    await waitFor(() => expect(status()).toBe("suspended"));
    expect(screen.getByTestId("reason-text").textContent).toBe("Spam");
  });

  it("two 401s -> signedOut with reason sessionExpired (one silent retry in between)", async () => {
    const a0 = setAuth0();
    const fetchSpy = fakeFetch({ "/api/me": err("UNAUTHENTICATED", 401) });
    vi.stubGlobal("fetch", fetchSpy);
    mount();
    await waitFor(() => expect(status()).toBe("signedOut"));
    expect(screen.getByTestId("reason").textContent).toBe("sessionExpired");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(a0.getAccessTokenSilently).toHaveBeenLastCalledWith({ cacheMode: "off" });
  });

  it("a network failure -> error of kind network; Try again only refetches", async () => {
    const a0 = setAuth0();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (++calls === 1) throw new TypeError("offline");
        return new Response(JSON.stringify({ user: meUser }), { status: 200 });
      }),
    );
    mount();
    await waitFor(() => expect(status()).toBe("error"));
    expect(screen.getByTestId("kind").textContent).toBe("network");
    act(() => screen.getByText("retry").click());
    await waitFor(() => expect(status()).toBe("signedIn"));
    expect(a0.loginWithRedirect).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "TOKEN_CLAIMS_MISSING (HTTP %i) -> error of kind claims, not a session end",
    async (code) => {
      setAuth0();
      const fetchSpy = fakeFetch({ "/api/me": err("TOKEN_CLAIMS_MISSING", code) });
      vi.stubGlobal("fetch", fetchSpy);
      mount();
      await waitFor(() => expect(status()).toBe("error"));
      expect(screen.getByTestId("kind").textContent).toBe("claims");
      expect(fetchSpy).toHaveBeenCalledTimes(1); // no pointless token retry
    },
  );

  it("an Auth0 error -> error of kind session; Try again signs in", async () => {
    const a0 = setAuth0({ isAuthenticated: false, error: new Error("boom") });
    mount();
    expect(status()).toBe("error");
    expect(screen.getByTestId("kind").textContent).toBe("session");
    act(() => screen.getByText("retry").click());
    await waitFor(() => expect(a0.loginWithRedirect).toHaveBeenCalled());
  });
});

describe("MFA_REQUIRED loop guard", () => {
  const mfa = () => fakeFetch({ "/api/me": err("MFA_REQUIRED", 403) });

  it("the first time: one automatic sign-in with prompt=login, and a timestamp is stored", async () => {
    const a0 = setAuth0();
    vi.stubGlobal("fetch", mfa());
    mount();
    await waitFor(() => expect(a0.loginWithRedirect).toHaveBeenCalledTimes(1));
    expect(a0.loginWithRedirect.mock.calls[0][0].authorizationParams.prompt).toBe("login");
    expect(Number(window.sessionStorage.getItem("nivaran.mfaAttemptAt"))).toBeGreaterThan(0);
  });

  it("coming back with it still failing: no second redirect, error of kind mfa", async () => {
    window.sessionStorage.setItem("nivaran.mfaAttemptAt", String(Date.now()));
    const a0 = setAuth0();
    vi.stubGlobal("fetch", mfa());
    mount();
    await waitFor(() => expect(status()).toBe("error"));
    expect(screen.getByTestId("kind").textContent).toBe("mfa");
    await act(async () => {});
    expect(a0.loginWithRedirect).not.toHaveBeenCalled();
  });

  it("an old attempt is forgotten once /api/me works", async () => {
    window.sessionStorage.setItem("nivaran.mfaAttemptAt", String(Date.now() - 10 * 60_000));
    setAuth0();
    vi.stubGlobal("fetch", fakeFetch({ "/api/me": [200, { user: meUser }] }));
    mount();
    await waitFor(() => expect(status()).toBe("signedIn"));
    await waitFor(() => expect(window.sessionStorage.getItem("nivaran.mfaAttemptAt")).toBeNull());
  });
});

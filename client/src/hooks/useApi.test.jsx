import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/components/auth/authContext";
import { SignInPromptContext } from "@/components/auth/signInPromptContext";
import { authState, fakeFetch } from "@/test/renderWithAuth";
import { MemoryRouter, useLocation } from "react-router";
import { useApi } from "./useApi";

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

function setup(table, auth = authState("verified")) {
  vi.stubGlobal("fetch", fakeFetch(table));
  const openSignIn = vi.fn();
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <SignInPromptContext.Provider value={{ openSignIn }}>
          <MemoryRouter initialEntries={["/admin/users?q=abc"]}>{children}</MemoryRouter>
        </SignInPromptContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  const hook = renderHook(
    () => ({ api: useApi(), path: useLocation().pathname, state: useLocation().state }),
    { wrapper },
  );
  return { ...hook, auth, openSignIn, invalidate };
}

const err = (code, status, details) => [status, { error: { code, message: "x", details } }];

describe("useApi", () => {
  it("returns the data of a good call", async () => {
    const { result } = setup({ "/api/x": [200, { a: 1 }] });
    await expect(result.current.api("/api/x")).resolves.toEqual({ a: 1 });
  });

  it("EMAIL_NOT_VERIFIED: marks the user unverified and goes to /verify-email with returnTo", async () => {
    const { result, auth } = setup({ "/api/x": err("EMAIL_NOT_VERIFIED", 403) });
    await expect(result.current.api("/api/x")).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    expect(auth.markUnverified).toHaveBeenCalled();
    await waitFor(() => expect(result.current.path).toBe("/verify-email"));
    expect(result.current.state).toEqual({ returnTo: "/admin/users?q=abc" });
  });

  it("SUSPENDED: stores the reason and goes to /suspended", async () => {
    const { result, auth } = setup({ "/api/x": err("SUSPENDED", 403, { reason: "Spam" }) });
    await expect(result.current.api("/api/x")).rejects.toMatchObject({ code: "SUSPENDED" });
    expect(auth.markSuspended).toHaveBeenCalledWith("Spam");
    await waitFor(() => expect(result.current.path).toBe("/suspended"));
  });

  it("MFA_REQUIRED twice in a row: only the first one redirects (no loop)", async () => {
    const { result, auth } = setup({ "/api/x": err("MFA_REQUIRED", 403) });
    await expect(result.current.api("/api/x")).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    await expect(result.current.api("/api/x")).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    expect(auth.login).toHaveBeenCalledTimes(1);
  });

  it("MFA_REQUIRED: signs in again with prompt=login", async () => {
    const { result, auth } = setup({ "/api/x": err("MFA_REQUIRED", 403) });
    await expect(result.current.api("/api/x")).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    expect(auth.login).toHaveBeenCalledWith("/admin/users?q=abc", { prompt: "login" });
  });

  it("401 twice: ends the session and opens the sign-in sheet in the expired wording", async () => {
    const { result, auth, openSignIn } = setup({ "/api/x": err("UNAUTHENTICATED", 401) });
    await expect(result.current.api("/api/x")).rejects.toMatchObject({ status: 401 });
    expect(auth.expireSession).toHaveBeenCalled();
    expect(openSignIn).toHaveBeenCalledWith({ returnTo: "/admin/users?q=abc", variant: "expired" });
  });

  it("FORBIDDEN re-reads /me so the guards can show the 403, and changes nothing else", async () => {
    const { result, auth, openSignIn, invalidate } = setup({ "/api/x": err("FORBIDDEN", 403) });
    await expect(result.current.api("/api/x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me"] });
    expect(auth.expireSession).not.toHaveBeenCalled();
    expect(openSignIn).not.toHaveBeenCalled();
    expect(result.current.path).toBe("/admin/users");
  });
});

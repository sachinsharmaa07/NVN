import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { vi } from "vitest";
import { AuthContext } from "@/components/auth/authContext";
import { SignInPromptContext } from "@/components/auth/signInPromptContext";
import { hasPermission, levelOf } from "@/lib/roles";

// Test users, one per kind of person the screens treat differently.
export const people = {
  citizen: {
    id: "u1",
    email: "asha@example.com",
    name: "Asha Rao",
    role: "citizen",
    emailVerified: true,
    status: "active",
  },
  unverified: {
    id: "u2",
    email: "ravi@example.com",
    name: "Ravi",
    role: "citizen",
    emailVerified: false,
    status: "active",
  },
  admin: {
    id: "u3",
    email: "meera@example.com",
    name: "Meera Iyer",
    role: "city_admin",
    cityId: "c1",
    emailVerified: true,
    status: "active",
  },
};

/*
 * A fake auth value for one state (docs 11.5): "loading", "signedOut", "unverified", "verified"
 * (citizen), "admin" (city_admin), "suspended", or "error". `extra` overrides any field.
 * Spies (login, logout, refresh, ...) are vi.fn() so tests can assert on them.
 */
export function authState(kind, extra = {}) {
  const user = { verified: people.citizen, unverified: people.unverified, admin: people.admin }[
    kind
  ];
  const status =
    {
      loading: "loading",
      signedOut: "signedOut",
      suspended: "suspended",
      error: "error",
    }[kind] ?? "signedIn";
  return {
    status,
    user: user ?? null,
    level: user ? levelOf(user.role) : 0,
    isVerified: Boolean(user?.emailVerified),
    can: (p) => hasPermission(user, p),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    retry: vi.fn(),
    getAuthHeaders: vi.fn(async () => ({ Authorization: "Bearer test-token" })),
    expireSession: vi.fn(),
    markSuspended: vi.fn(),
    markUnverified: vi.fn(),
    ...extra,
  };
}

/*
 * Renders `ui` at `path` inside a fake auth context, a fresh QueryClient (no retries) and a
 * memory router. `routes` adds stand-in pages ({ "/suspended": <p>suspended</p> }) so redirects
 * can be seen. Returns Testing Library's result plus { auth, openSignIn }.
 */
export function renderWithAuth(ui, { auth, path = "/", state, routePath = "*", routes = {} } = {}) {
  const openSignIn = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <SignInPromptContext.Provider value={{ openSignIn }}>
          <MemoryRouter
            initialEntries={[
              state
                ? {
                    pathname: path.split("?")[0],
                    search: path.includes("?") ? "?" + path.split("?")[1] : "",
                    state,
                  }
                : path,
            ]}
          >
            <Routes>
              <Route path={routePath} element={ui} />
              {Object.entries(routes).map(([p, el]) => (
                <Route key={p} path={p} element={el} />
              ))}
            </Routes>
          </MemoryRouter>
        </SignInPromptContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...result, auth, openSignIn, client };
}

// A fetch stand-in that answers by URL: respond({ "/api/me": [200, {...}] }) -> vi.fn().
export function fakeFetch(table) {
  return vi.fn(async (url, init) => {
    // The key that matches latest in the URL wins, so "/role" beats "/api/admin/users".
    const key = Object.keys(table)
      .filter((k) => String(url).includes(k))
      .sort((a, b) => String(url).lastIndexOf(b) - String(url).lastIndexOf(a))[0];
    const answer = typeof table[key] === "function" ? table[key](url, init) : table[key];
    const [status, body, headers] = answer ?? [404, { error: { code: "NOT_FOUND", message: "x" } }];
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  });
}

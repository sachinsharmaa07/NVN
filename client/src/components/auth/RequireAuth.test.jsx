import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "./authContext";
import { RequireAuth } from "./RequireAuth";

const verifiedUser = { id: "1", email: "asha@example.com", name: "Asha", emailVerified: true };

// Renders a protected page at /report?pincode=144401, with a fake auth state.
function renderAt(auth, { verified = false } = {}) {
  function Where() {
    const { pathname, state } = useLocation();
    return (
      <p>
        at {pathname} from {state?.returnTo ?? "nowhere"}
      </p>
    );
  }
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/report?pincode=144401"]}>
        <Routes>
          <Route
            path="/report"
            element={
              <RequireAuth verified={verified}>
                <p>secret page</p>
              </RequireAuth>
            }
          />
          <Route path="/verify-email" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("RequireAuth", () => {
  it("shows the page to a signed-in user", () => {
    renderAt({ status: "signedIn", user: verifiedUser });
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });

  it("asks a signed-out visitor to sign in and remembers where they were going", async () => {
    const login = vi.fn();
    renderAt({ status: "signedOut", user: null, login });
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(login).toHaveBeenCalledWith("/report?pincode=144401");
  });

  it("sends a signed-in user with an unverified email to /verify-email when verification is required", () => {
    renderAt(
      { status: "signedIn", user: { ...verifiedUser, emailVerified: false } },
      { verified: true },
    );
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    expect(screen.getByText("at /verify-email from /report?pincode=144401")).toBeInTheDocument();
  });

  it("lets an unverified user into a page that does not require verification", () => {
    renderAt({ status: "signedIn", user: { ...verifiedUser, emailVerified: false } });
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });

  it("says plainly when sign-in is not set up, and shows no page", () => {
    renderAt({ status: "unconfigured", user: null });
    expect(screen.getByText("Sign-in isn't set up yet")).toBeInTheDocument();
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
  });

  it("shows a loading state, never the page, while it checks", () => {
    renderAt({ status: "loading", user: null });
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
  });

  it("offers a retry when the account could not be loaded", async () => {
    const refresh = vi.fn();
    renderAt({ status: "error", user: null, error: new Error("Network down"), refresh });
    expect(screen.getByText("Network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalled();
  });
});

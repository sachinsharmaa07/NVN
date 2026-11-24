import { fireEvent, screen } from "@testing-library/react";
import { useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { authState, people, renderWithAuth } from "@/test/renderWithAuth";
import { RequireAuth } from "./RequireAuth";

function Where() {
  const { pathname, state } = useLocation();
  return (
    <p>
      at {pathname} from {state?.returnTo ?? "nowhere"}
    </p>
  );
}

// Renders a protected page at /report?pincode=144401 with a fake auth state.
function renderAt(auth, props = {}) {
  return renderWithAuth(
    <RequireAuth {...props}>
      <p>secret page</p>
    </RequireAuth>,
    {
      auth,
      path: "/report?pincode=144401",
      routePath: "/report",
      routes: { "/verify-email": <Where />, "/suspended": <p>suspended page</p> },
    },
  );
}

describe("RequireAuth", () => {
  it("shows the page to a signed-in user", () => {
    renderAt(authState("verified"));
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });

  it("asks a signed-out visitor to sign in and remembers where they were going", () => {
    const auth = authState("signedOut");
    renderAt(auth);
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.login).toHaveBeenCalledWith("/report?pincode=144401");
  });

  it("sends an unverified user to /verify-email when verification is required", () => {
    renderAt(authState("unverified"), { verified: true });
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    expect(screen.getByText("at /verify-email from /report?pincode=144401")).toBeInTheDocument();
  });

  it("lets an unverified user into a page that does not require verification", () => {
    renderAt(authState("unverified"));
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });

  it("says plainly when sign-in is not set up, and shows no page", () => {
    renderAt({ status: "unconfigured", user: null });
    expect(screen.getByText("Sign-in isn't set up yet")).toBeInTheDocument();
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
  });

  it("loading never renders children: a busy skeleton instead", () => {
    renderAt(authState("loading"));
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("offers a retry when the account could not be loaded", () => {
    const auth = authState("error", { error: { kind: "network", message: "Network down" } });
    renderAt(auth);
    expect(screen.getByText("Network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(auth.retry).toHaveBeenCalled();
  });

  it("a claims error offers only Sign out, no retry", () => {
    const auth = authState("error", { error: { kind: "claims", message: "no email" } });
    renderAt(auth);
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it("a suspended user is sent to /suspended", () => {
    renderAt(authState("suspended"));
    expect(screen.getByText("suspended page")).toBeInTheDocument();
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
  });

  describe("permission guard", () => {
    it("a citizen sees the 403 page in place, not the page", () => {
      renderAt(authState("verified"), { permission: "user:read_scope" });
      expect(
        screen.getByRole("heading", { name: "You don't have access to this page" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    });
    it("an admin sees the page", () => {
      renderAt(authState("admin"), { permission: "user:read_scope" });
      expect(screen.getByText("secret page")).toBeInTheDocument();
    });
    it("minLevel blocks a lower level and lets a higher one in", () => {
      renderAt(authState("verified"), { minLevel: 2 });
      expect(screen.queryByText("secret page")).not.toBeInTheDocument();
      renderAt(authState("admin"), { minLevel: 2 });
      expect(screen.getByText("secret page")).toBeInTheDocument();
    });
    it("the server's permissions[] wins over the local matrix", () => {
      renderAt(
        authState("verified", { user: { ...people.citizen, permissions: ["user:read_scope"] } }),
        {
          permission: "user:read_scope",
        },
      );
      expect(screen.getByText("secret page")).toBeInTheDocument();
    });
  });
});

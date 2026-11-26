import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, renderWithAuth } from "@/test/renderWithAuth";
import { AccountMenu } from "./AccountMenu";

afterEach(() => vi.useRealTimers());

const open = () =>
  fireEvent.keyDown(screen.getByRole("button", { name: "Your account" }), { key: "Enter" });

describe("AccountMenu", () => {
  it("loading: no Sign in button, only a status for screen readers; a skeleton after 200ms", async () => {
    vi.useFakeTimers();
    const { container } = renderWithAuth(<AccountMenu />, { auth: authState("loading") });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking your sign-in");
    expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(container.querySelector("[data-slot=skeleton]")).not.toBeNull();
  });

  it("signed out: Sign in opens the sheet with the current page as returnTo", () => {
    const { openSignIn } = renderWithAuth(<AccountMenu />, {
      auth: authState("signedOut"),
      path: "/community?x=1",
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(openSignIn).toHaveBeenCalledWith({ returnTo: "/community?x=1" });
  });

  it("signed in: shows who, Profile and Sign out; no Admin link for a citizen", () => {
    const auth = authState("verified");
    renderWithAuth(<AccountMenu />, { auth });
    open();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("menuitem", { name: "Admin: Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Verify your email" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it("admin: the Admin: Users link is there", () => {
    renderWithAuth(<AccountMenu />, { auth: authState("admin") });
    open();
    expect(screen.getByRole("menuitem", { name: "Admin: Users" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  });

  it("unverified: no verify item (there is no verification link any more)", () => {
    renderWithAuth(<AccountMenu />, { auth: authState("unverified") });
    open();
    expect(screen.getAllByRole("menuitem")[0]).toHaveTextContent("Profile");
    expect(screen.queryByText("Verify your email")).not.toBeInTheDocument();
  });

  it("suspended: only Sign out", () => {
    const auth = authState("suspended");
    renderWithAuth(<AccountMenu />, { auth });
    expect(screen.queryByRole("button", { name: "Your account" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it("error: a warning button with Try again and Sign out", () => {
    const auth = authState("error", { error: { kind: "network", message: "x" } });
    renderWithAuth(<AccountMenu />, { auth });
    fireEvent.keyDown(screen.getByRole("button", { name: "Account unavailable" }), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Try again" }));
    expect(auth.retry).toHaveBeenCalled();
  });

  it("unconfigured: renders nothing", () => {
    const { container } = renderWithAuth(<AccountMenu />, {
      auth: { status: "unconfigured", user: null },
    });
    expect(container).toBeEmptyDOMElement();
  });
});

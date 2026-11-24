import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { authState, renderWithAuth } from "@/test/renderWithAuth";
import Forbidden from "./Forbidden";
import { Suspended } from "./Suspended";

describe("Suspended page", () => {
  it("shows the reason, who to contact and Sign out, and no app navigation", () => {
    const auth = authState("suspended", { suspendedReason: "Repeated spam posts" });
    renderWithAuth(<Suspended />, { auth });
    expect(
      screen.getByRole("heading", { level: 1, name: "Your account is suspended" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Reason: Repeated spam posts/)).toBeInTheDocument();
    expect(screen.getByText(/contact your city admin/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it("says so when no reason was recorded", () => {
    renderWithAuth(<Suspended />, { auth: authState("suspended") });
    expect(screen.getByText(/No reason was recorded/)).toBeInTheDocument();
  });

  it("sends an active user home", () => {
    renderWithAuth(<Suspended />, {
      auth: authState("verified"),
      path: "/suspended",
      routePath: "/suspended",
      routes: { "/": <p>home</p> },
    });
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("shows nothing while it is still checking", () => {
    const { container } = renderWithAuth(<Suspended />, { auth: authState("loading") });
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Forbidden page", () => {
  it("has one h1, the hint and a way home", () => {
    renderWithAuth(<Forbidden />, { auth: authState("verified") });
    expect(
      screen.getByRole("heading", { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ask your city admin/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/");
  });
});

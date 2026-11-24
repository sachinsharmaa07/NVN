import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SIDEBAR_STORAGE_KEY } from "@/hooks/useSidebarCollapsed";
import { t } from "@/i18n/t";
import { AppLayout } from "./AppLayout";

// Stand-in pages, so these tests check the shell only (not the real, lazy-loaded pages).
const page = (name) => <h1>{name}</h1>;

function renderShell(path = "/") {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: page("Home page") },
          { path: "issues", element: page("Issues page") },
          { path: "report", element: page("Report page") },
          { path: "community", element: page("Community page") },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <ThemeProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </ThemeProvider>,
  );
}

// jsdom has neither matchMedia (theme, reduced motion, desktop check) nor scrollTo
// (ScrollRestoration). Here no media query matches: a phone-sized screen with motion allowed.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query) => ({
    media: query,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("scrollTo", () => {});
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  localStorage.clear();
});

// jsdom doesn't apply CSS, so the bottom bar and the sidebar are both in the DOM.
// The bottom bar is the "Main" nav that is not inside the sidebar's <aside>.
function getBottomBar() {
  const navs = screen.getAllByRole("navigation", { name: t("shell.nav.label") });
  return navs.find((nav) => !nav.closest("aside"));
}

function getSidebar() {
  const navs = screen.getAllByRole("navigation", { name: t("shell.nav.label") });
  return navs.find((nav) => nav.closest("aside"));
}

describe("AppLayout", () => {
  it("shows four bottom bar items and marks the current page", () => {
    renderShell("/issues");
    const links = within(getBottomBar()).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      t("shell.nav.home"),
      t("shell.nav.issues"),
      t("shell.nav.report"),
      t("shell.nav.community"),
    ]);
    const current = links.filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(t("shell.nav.issues"));
  });

  it("marks Home as current only on the home page", () => {
    renderShell("/");
    const home = within(getBottomBar()).getByRole("link", { name: t("shell.nav.home") });
    expect(home).toHaveAttribute("aria-current", "page");
  });

  it("swaps the page straight away when you navigate (no exit animation)", async () => {
    renderShell("/");
    fireEvent.click(within(getBottomBar()).getByRole("link", { name: t("shell.nav.community") }));

    expect(await screen.findByRole("heading", { name: "Community page" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Home page" })).not.toBeInTheDocument();
  });

  it("has a skip link that points at the main landmark", () => {
    renderShell("/");
    const skip = screen.getByRole("link", { name: t("app.skipToContent") });
    expect(skip).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("lists Report an issue first in the sidebar", () => {
    renderShell("/");
    const first = within(getSidebar()).getAllByRole("link")[0];
    expect(first).toHaveTextContent(t("shell.nav.reportLong"));
  });

  it("remembers a collapsed sidebar between visits", () => {
    const { unmount } = renderShell("/");
    fireEvent.click(screen.getByRole("button", { name: t("shell.sidebar.collapse") }));

    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    expect(screen.getByRole("button", { name: t("shell.sidebar.expand") })).toBeInTheDocument();
    // Collapsed links keep their names for screen readers.
    expect(
      within(getSidebar()).getByRole("link", { name: t("shell.nav.community") }),
    ).toBeInTheDocument();

    unmount();
    renderShell("/");
    expect(screen.getByRole("button", { name: t("shell.sidebar.expand") })).toBeInTheDocument();
  });

  it("shows the help chat button, except on the report page", () => {
    const { unmount } = renderShell("/");
    expect(screen.getByRole("button", { name: t("shell.chat.open") })).toBeInTheDocument();
    unmount();

    renderShell("/report");
    expect(screen.queryByRole("button", { name: t("shell.chat.open") })).not.toBeInTheDocument();
  });
});

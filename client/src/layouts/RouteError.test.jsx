import { render, screen } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteError } from "./RouteError";

function Boom() {
  throw new Error("render failed");
}

// The same shape as router.jsx: a frame, then a pathless route with errorElement around the pages.
function renderThrowingRoute() {
  const router = createMemoryRouter(
    [
      {
        element: (
          <div>
            <nav aria-label="Main">frame</nav>
            <Outlet />
          </div>
        ),
        children: [{ errorElement: <RouteError />, children: [{ path: "/", element: <Boom /> }] }],
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("RouteError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("replaces only the page that threw, inside the frame, with a way home", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderThrowingRoute();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "This page didn't load" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/");
  });
});

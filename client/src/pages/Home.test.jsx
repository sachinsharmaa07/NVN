import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "@/i18n/t";
import { Home } from "./Home";

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// A fresh QueryClient per test (no shared cache) with retries off, so errors show at once.
function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/", element: <Home /> }]);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Home health card", () => {
  it("shows the checking state, then that the API and database are up", async () => {
    let answer;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => (answer = resolve))),
    );
    renderHome();

    expect(screen.getByRole("status")).toHaveTextContent(t("home.health.checking"));

    answer(jsonResponse(200, { status: "ok", db: "up", uptime: 1, version: "0.1.0" }));
    expect(await screen.findByText(t("home.health.ok"))).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/health$/), expect.any(Object));
  });

  it("shows the database-down message when the server answers 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(503, { status: "degraded", db: "down" })),
    );
    renderHome();

    expect(await screen.findByText(t("home.health.down"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("common.retry") })).not.toBeInTheDocument();
  });

  it("shows an error with a working Try again button when the network fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", db: "up" }));
    vi.stubGlobal("fetch", fetchMock);
    renderHome();

    expect(await screen.findByText(t("home.health.error"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("common.retry") }));

    expect(await screen.findByText(t("home.health.ok"))).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFetch } from "@/test/renderWithAuth";
import { StatsRow } from "./StatsRow";

function show(answer) {
  const spy = fakeFetch({ "/api/stats": answer });
  vi.stubGlobal("fetch", spy);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <StatsRow />
    </QueryClientProvider>,
  );
  return { spy, ...view };
}
// StatCard counts up when in view (motion's useInView); jsdom has no IntersectionObserver.
beforeEach(() =>
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => vi.unstubAllGlobals());

describe("Landing StatsRow", () => {
  it("shows the real numbers with Indian grouping and no token", async () => {
    const { spy } = show([
      200,
      {
        totalReports: 125000,
        resolved: 3,
        medianResolutionHours: 20,
        openByCategory: { pothole: 2, garbage: 0, other: 1 },
      },
    ]);
    expect(await screen.findByText("1,25,000")).toBeInTheDocument();
    expect(screen.getByText("Open right now").nextSibling).toHaveTextContent(/^3/);
    expect(spy.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("hides the whole row when the stats fail", async () => {
    const { spy, container } = show([500, { error: { code: "INTERNAL_ERROR", message: "x" } }]);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

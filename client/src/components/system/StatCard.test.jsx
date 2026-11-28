import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatCard } from "./StatCard";

// motion's useInView needs IntersectionObserver, which jsdom lacks (same stub as StatsRow.test.jsx).
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

describe("StatCard", () => {
  it("shows the value for screen readers", () => {
    render(<StatCard label="Issues fixed" value={150000} />);
    expect(screen.getByText("1,50,000")).toBeInTheDocument();
  });

  it("says there is no data instead of showing 0 when empty", () => {
    render(<StatCard label="Issues fixed" value={0} empty />);
    expect(screen.getByText("No reports yet")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./StatCard";

// What a screen reader hears: skip NumberFlow's aria-hidden digits, which show the same value.
const SPOKEN = { ignore: '[aria-hidden="true"], [aria-hidden="true"] *, script, style' };

describe("StatCard", () => {
  it("shows the value for screen readers", () => {
    render(<StatCard label="Issues fixed" value={150000} />);
    expect(screen.getByText("1,50,000", SPOKEN)).toBeInTheDocument();
  });

  it("says there is no data instead of showing 0 when empty", () => {
    render(<StatCard label="Issues fixed" value={0} empty />);
    expect(screen.getByText("No reports yet")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

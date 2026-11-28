import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "./FilterBar";

const filters = (value = "") => [
  {
    key: "sla",
    label: "SLA",
    allLabel: "Any",
    options: [["at_risk", "At risk"]],
    value,
  },
];

function desktop(on) {
  vi.stubGlobal("matchMedia", (query) => ({
    matches: on && query.includes("min-width: 1024px"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}
afterEach(() => vi.unstubAllGlobals());

describe("FilterBar", () => {
  it("from 1024px: labelled selects, and Clear filters only when one is set", () => {
    desktop(true);
    const onClear = vi.fn();
    const { rerender } = render(
      <FilterBar filters={filters()} onChange={() => {}} onClear={onClear} />,
    );
    expect(screen.getByRole("combobox", { name: "SLA" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    rerender(<FilterBar filters={filters("at_risk")} onChange={() => {}} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("below 1024px: a Filters button that counts what is set", () => {
    desktop(false);
    render(<FilterBar filters={filters("at_risk")} onChange={() => {}} onClear={() => {}} />);
    expect(screen.getByRole("button", { name: "Filters (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("below 1024px: Apply sends nothing when nothing changed, and closes", () => {
    desktop(false);
    const onChange = vi.fn();
    render(<FilterBar filters={filters()} onChange={onChange} onClear={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("combobox", { name: "SLA" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Apply filters" })).not.toBeInTheDocument();
  });
});

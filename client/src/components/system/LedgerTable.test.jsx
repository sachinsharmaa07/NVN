import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LedgerTable } from "./LedgerTable";

const ROWS = [
  { id: "a", title: "Deep pothole", due: "3 Dec" },
  { id: "b", title: "Broken light", due: "4 Dec" },
];
const COLUMNS = [
  { key: "title", header: "Issue", cell: (r) => <button type="button">{r.title}</button> },
  { key: "due", header: "Due", align: "right", cell: (r) => r.due },
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

const table = (props) =>
  render(
    <LedgerTable
      columns={COLUMNS}
      rows={ROWS}
      getRowKey={(r) => r.id}
      renderCard={(r, selected) => (
        <button type="button" aria-pressed={selected}>
          {r.title}
        </button>
      )}
      caption="Issues"
      {...props}
    />,
  );

describe("LedgerTable", () => {
  it("is a table from 1024px, the first cell a row header, right-aligned columns aligned", () => {
    desktop(true);
    table({ countLabel: "2 open issues, due soonest first" });
    expect(screen.getByRole("table", { name: "Issues" })).toBeInTheDocument();
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Due" })).toHaveClass("text-right");
    expect(screen.getByText("2 open issues, due soonest first")).toBeInTheDocument();
  });

  it("marks the open row as selected", () => {
    desktop(true);
    table({ selectedKey: "b" });
    const row = screen.getByRole("rowheader", { name: "Broken light" }).closest("tr");
    expect(row).toHaveAttribute("data-state", "selected");
  });

  it("is a list of cards below 1024px, passing the selection to the card", () => {
    desktop(false);
    table({ selectedKey: "a" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getByRole("button", { name: "Deep pothole" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("dims the old rows while new ones load, instead of a skeleton", () => {
    desktop(true);
    const { container } = table({ busy: true });
    const dimmed = container.querySelector("[aria-busy=true]");
    expect(dimmed).toHaveClass("opacity-60");
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);
    expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
  });

  it("shows the empty node, and an inline error with Try again", () => {
    desktop(true);
    const { rerender } = table({ rows: [], empty: <p>Nothing here</p> });
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    const onRetry = vi.fn();
    rerender(
      <LedgerTable
        columns={COLUMNS}
        rows={[]}
        getRowKey={(r) => r.id}
        isError
        errorTitle="Couldn't load the queue"
        onRetry={onRetry}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offers Load more only when there is more", () => {
    desktop(true);
    const onLoadMore = vi.fn();
    const { rerender } = table({ hasMore: false });
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    rerender(
      <LedgerTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={(r) => r.id}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});

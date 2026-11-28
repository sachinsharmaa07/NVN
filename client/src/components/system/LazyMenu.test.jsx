import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LazyMenu } from "./LazyMenu";

function TestMenu({ trigger, defaultOpen }) {
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>First</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// A chunk that arrives only when the test says so, like a slow network.
function slowChunk() {
  let arrive;
  const promise = new Promise((resolve) => (arrive = () => resolve({ default: TestMenu })));
  return { load: () => promise, arrive };
}

const trigger = <Button>Options</Button>;

describe("LazyMenu", () => {
  it("a click before the chunk arrives opens the menu once it lands", async () => {
    const { load, arrive } = slowChunk();
    render(<LazyMenu load={load} trigger={trigger} />);
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    arrive();
    expect(await screen.findByRole("menuitem", { name: "First" })).toBeInTheDocument();
  });

  it("ArrowDown on the trigger also opens it once loaded", async () => {
    const { load, arrive } = slowChunk();
    render(<LazyMenu load={load} trigger={trigger} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Options" }), { key: "ArrowDown" });
    arrive();
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  it("a focused placeholder hands focus to the real trigger, closed", async () => {
    const { load, arrive } = slowChunk();
    render(<LazyMenu load={load} trigger={trigger} />);
    const placeholder = screen.getByRole("button", { name: "Options" });
    expect(placeholder).toHaveAttribute("aria-haspopup", "menu");
    placeholder.focus();
    fireEvent.focus(placeholder);
    arrive();
    await screen.findByRole("button", { name: "Options", expanded: false });
    expect(screen.getByRole("button", { name: "Options" })).not.toBe(placeholder);
    expect(screen.getByRole("button", { name: "Options" })).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

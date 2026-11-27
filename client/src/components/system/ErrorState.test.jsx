import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("announces the page variant and offers a retry", () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Couldn't load your issues" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your issues");
    expect(screen.getByText("Check your connection and try again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps the inline variant quiet", () => {
    render(<ErrorState variant="inline" title="Couldn't load comments" onRetry={() => {}} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a busy, disabled retry while retrying", () => {
    render(<ErrorState title="Couldn't load" onRetry={() => {}} retrying />);
    const button = screen.getByRole("button", { name: /Trying again/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button loading", () => {
  it("is disabled, busy and keeps its label while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Submit report
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Submit report" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is a normal, enabled button when not loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading={false} onClick={onClick}>
        Submit report
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Submit report" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

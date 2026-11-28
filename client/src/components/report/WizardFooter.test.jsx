import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardFooter } from "./WizardFooter";

describe("WizardFooter", () => {
  it("explains a disabled Next with a linked hint", () => {
    render(<WizardFooter nextDisabled disabledHint="Enter all 6 digits to continue." />);
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription("Enter all 6 digits to continue.");
  });

  it("drops the hint once Next is enabled, and goes Back and Next", () => {
    const onBack = vi.fn();
    const onNext = vi.fn();
    render(<WizardFooter onBack={onBack} onNext={onNext} disabledHint="Not yet" />);
    expect(screen.queryByText("Not yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("shows a busy, disabled Next while submitting, with no hint", () => {
    render(<WizardFooter submitting disabledHint="Not yet" nextLabel="Submitting…" />);
    const next = screen.getByRole("button", { name: /Submitting/ });
    expect(next).toBeDisabled();
    expect(next).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Not yet")).not.toBeInTheDocument();
  });

  it("has no Back on the first step", () => {
    render(<WizardFooter />);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });
});

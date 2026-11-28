import { render, screen } from "@testing-library/react";
import { FileText } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";
import { PhotoSlot } from "./PhotoSlot";

describe("EmptyState", () => {
  it("shows the icon tile in the page variant", () => {
    const { container } = render(<EmptyState icon={FileText} title="No issues yet" hint="Why" />);
    expect(screen.getByRole("heading", { name: "No issues yet" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("drops the icon tile in the inline variant", () => {
    const { container } = render(
      <EmptyState variant="inline" icon={FileText} title="No comments" hint="Be the first." />,
    );
    expect(screen.getByRole("heading", { name: "No comments" })).toBeInTheDocument();
    expect(screen.getByText("Be the first.")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});

describe("PhotoSlot", () => {
  it("shows its label with a decorative icon", () => {
    const { container } = render(<PhotoSlot label="Your photo" />);
    expect(screen.getByText("Your photo")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

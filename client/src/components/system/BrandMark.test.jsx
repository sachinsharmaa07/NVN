import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "@/i18n/t";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  afterEach(() => setLanguage("en"));

  it("shows the wordmark and hides the decorative SVG", () => {
    const { container } = render(<BrandMark />);
    expect(screen.getByText("Nivaran")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("has a small size for the Landing footer", () => {
    const { container } = render(<BrandMark size="sm" />);
    expect(container.querySelector("svg")).toHaveClass("size-4");
    expect(screen.getByText("Nivaran")).toHaveClass("text-base");
  });

  it("shows the Hindi wordmark in Hindi", () => {
    setLanguage("hi");
    render(<BrandMark />);
    expect(screen.getByText("निवारण")).toBeInTheDocument();
  });
});

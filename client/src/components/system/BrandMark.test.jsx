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

  it("shows the Hindi wordmark in Hindi", () => {
    setLanguage("hi");
    render(<BrandMark />);
    expect(screen.getByText("निवारण")).toBeInTheDocument();
  });
});

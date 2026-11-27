import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormStrip } from "./FormStrip";

const STEPS = [
  { title: "Enter your pincode", body: "We check your area." },
  { title: "Drop a pin", body: "Where the problem is." },
  { title: "Add details", body: "A photo and a note." },
];

describe("FormStrip", () => {
  it("reads each step as number, title, body", () => {
    render(<FormStrip steps={STEPS} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "1Enter your pincodeWe check your area.",
      "2Drop a pinWhere the problem is.",
      "3Add detailsA photo and a note.",
    ]);
  });

  it("marks only the current step", () => {
    render(<FormStrip steps={STEPS} current={1} />);
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("marks no step when there is no current one", () => {
    render(<FormStrip steps={STEPS} />);
    for (const li of screen.getAllByRole("listitem"))
      expect(li).not.toHaveAttribute("aria-current");
  });
});

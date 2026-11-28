import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

// UI.md §4.2: interactive cards never lift on hover; they answer with the border and the press scale.
describe("Card interactive", () => {
  it("has no hover lift and uses the press scale", () => {
    render(
      <Card interactive asChild>
        <a href="/x">Issue</a>
      </Card>,
    );
    const { className } = screen.getByRole("link", { name: "Issue" });
    expect(className).not.toMatch(/hover:-translate-y/);
    expect(className).toMatch(/\bpress-scale\b/);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeforeAfter } from "./BeforeAfter";

const photo = (id) => ({
  publicId: id,
  url: `https://res.cloudinary.com/demo/image/upload/${id}`,
  width: 800,
  height: 600,
});

describe("BeforeAfter", () => {
  it("shows both sides as one pair, captioned Before and After", () => {
    render(<BeforeAfter before={[photo("b1")]} after={[photo("a1")]} open={false} />);
    expect(screen.getByRole("img", { name: "Photo from the report, photo 1" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Photo after the fix, photo 1" })).toBeInTheDocument();
    expect(screen.getAllByRole("figure").map((f) => f.textContent)).toEqual(["Before", "After"]);
  });

  it("holds a slot for the after photo while the issue is open", () => {
    render(<BeforeAfter before={[photo("b1")]} after={[]} open />);
    expect(screen.getByText("Photo after the fix")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
  });

  it("closed without an after photo: Before alone, no slot", () => {
    render(<BeforeAfter before={[photo("b1")]} after={[]} open={false} />);
    expect(screen.queryByText("After")).not.toBeInTheDocument();
    expect(screen.getAllByRole("figure")).toHaveLength(1);
  });

  it("renders nothing with no photos on a closed issue", () => {
    const { container } = render(<BeforeAfter before={[]} after={[]} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

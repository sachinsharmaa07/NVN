import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScopeFields } from "@/components/admin/ScopeFields";

const needs = { city: true, department: false, state: false };

describe("ScopeFields city search", () => {
  it("typing searches, and the chosen city stays listed when the next search no longer has it", () => {
    const onCityQuery = vi.fn();
    const onChange = vi.fn();
    const props = { needs, onChange, onCityQuery, cityQuery: "" };
    const { rerender } = render(
      <ScopeFields {...props} scope={{ cityId: "" }} cities={[{ id: "c1", name: "Ludhiana" }]} />,
    );
    fireEvent.change(screen.getByLabelText("Search cities by name"), { target: { value: "kap" } });
    expect(onCityQuery).toHaveBeenCalledWith("kap");

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Ludhiana" }));
    expect(onChange).toHaveBeenCalledWith({ cityId: "c1", departmentId: "" });

    rerender(
      <ScopeFields
        {...props}
        scope={{ cityId: "c1" }}
        cities={[{ id: "c2", name: "Kapurthala" }]}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Ludhiana");
  });
});

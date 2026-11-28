import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { CityFormDialog } from "./CityFormDialog";

afterEach(() => vi.unstubAllGlobals());

// The server's rules are checked here first, so a bad form never reaches the API.
describe("CityFormDialog", () => {
  it("checks name, code and state before sending anything", () => {
    const fetch = fakeFetch({});
    vi.stubGlobal("fetch", fetch);
    renderWithAuth(<CityFormDialog open onOpenChange={() => {}} />, {
      auth: authState("admin"),
    });
    fireEvent.change(screen.getByLabelText("City name"), { target: { value: "J" } });
    fireEvent.change(screen.getByLabelText("City code"), { target: { value: "-bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Add city" }));
    expect(screen.getByText("Enter a name of 2 to 100 characters.")).toBeInTheDocument();
    expect(screen.getByText(/Use letters, digits and dashes/)).toBeInTheDocument();
    expect(screen.getByText("Choose the city's state.")).toBeInTheDocument();
    expect(screen.getByLabelText("City code")).toHaveAttribute("aria-invalid", "true");
    expect(fetch.mock.calls.some(([u]) => String(u).includes("/api/admin/cities"))).toBe(false);
  });

  it("upper-cases the code as it is typed", () => {
    renderWithAuth(<CityFormDialog open onOpenChange={() => {}} />, {
      auth: authState("admin"),
    });
    fireEvent.change(screen.getByLabelText("City code"), { target: { value: "pb jal" } });
    expect(screen.getByLabelText("City code")).toHaveValue("PBJAL");
  });
});

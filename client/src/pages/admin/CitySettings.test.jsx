import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { CitySettings } from "./CitySettings";

afterEach(() => vi.unstubAllGlobals());

const row = (category, over = {}) => ({
  category,
  departmentId: null,
  respondHours: 24,
  resolveHours: 72,
  hoursFrom: "national",
  ...over,
});
const settings = {
  city: { id: "c1", name: "Kapurthala" },
  departments: [
    { id: "d1", name: "Roads" },
    { id: "d2", name: "Water" },
  ],
  categories: [row("pothole", { departmentId: "d1", resolveHours: 168 }), row("other")],
};

function setup(
  put = [200, row("pothole", { departmentId: "d1", resolveHours: 96, hoursFrom: "city" })],
) {
  const spy = fakeFetch({
    "/api/admin/city-settings": (url, init) => (init?.method === "PUT" ? put : [200, settings]),
  });
  vi.stubGlobal("fetch", spy);
  renderWithAuth(<CitySettings />, { auth: authState("admin"), path: "/admin/city-settings" });
  return spy;
}

describe("City settings", () => {
  it("shows each category with its department and where its hours come from", async () => {
    setup();
    expect(
      await screen.findByRole("heading", { name: "Pothole or broken road" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/in Kapurthala/)).toBeInTheDocument();
    expect(screen.getAllByText("Using the national default")).toHaveLength(2);
    expect(
      screen.getByText('"Something else" always goes to the triage queue.'),
    ).toBeInTheDocument();
  });

  it("saves one category's hours", async () => {
    const spy = setup();
    await screen.findByRole("heading", { name: "Pothole or broken road" });
    fireEvent.change(screen.getAllByLabelText("Fix within (hours)")[0], {
      target: { value: "96" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Pothole or broken road" }));
    await waitFor(() => {
      const call = spy.mock.calls.find(([, i]) => i?.method === "PUT");
      expect(String(call[0])).toContain("/api/admin/city-settings/pothole");
      expect(JSON.parse(call[1].body)).toEqual({
        departmentId: "d1",
        respondHours: 24,
        resolveHours: 96,
      });
    });
    expect(await screen.findByText("Set for this city")).toBeInTheDocument();
  });

  it("refuses fix-by shorter than respond-by without calling the server", async () => {
    const spy = setup();
    await screen.findByRole("heading", { name: "Pothole or broken road" });
    fireEvent.change(screen.getAllByLabelText("Fix within (hours)")[0], { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Pothole or broken road" }));
    expect(await screen.findByText(/fix-by at least respond-by/)).toBeInTheDocument();
    expect(spy.mock.calls.some(([, i]) => i?.method === "PUT")).toBe(false);
  });
});

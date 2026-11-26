import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { MapStep } from "./MapStep";

// jsdom can't draw Leaflet. The stub shows the pin and lets a test drop it inside or outside.
vi.mock("@/components/report/PinMap", () => ({
  default: ({ pin, onPin, onOutside, label }) => (
    <div aria-label={label}>
      <span>{pin ? pin.join(",") : "no pin"}</span>
      <button onClick={() => onPin([75.385, 31.381])}>drop inside</button>
      <button onClick={onOutside}>drop outside</button>
    </div>
  ),
}));

const area = {
  pin: "144601",
  served: true,
  precision: "approx",
  boundary: null,
  centroid: { type: "Point", coordinates: [75.38, 31.38] },
  radiusM: 4000,
  localities: [],
};

function setup(table, props = {}) {
  vi.stubGlobal("fetch", fakeFetch({ "/api/pincodes/144601": [200, area], ...table }));
  const onNext = vi.fn();
  renderWithAuth(<MapStep pincode="144601" onBack={vi.fn()} onNext={onNext} {...props} />, {
    auth: authState("verified"),
  });
  return { onNext };
}
const next = () => screen.getByRole("button", { name: "Next" });

afterEach(() => vi.unstubAllGlobals());

describe("Report step 2: map", () => {
  it("starts without a pin, labels the approximate area, and Next confirms with the server", async () => {
    const { onNext } = setup({
      "/check-point": [200, { inside: true, precision: "approx" }],
    });
    expect(await screen.findByText(/Approximate area/)).toBeInTheDocument();
    expect(await screen.findByText("no pin")).toBeInTheDocument();
    expect(next()).toBeDisabled();
    fireEvent.click(screen.getByText("drop inside"));
    fireEvent.click(next());
    await waitFor(() =>
      expect(onNext).toHaveBeenCalledWith({ lat: 31.381, lng: 75.385, precision: "approx" }),
    );
  });

  it("a refused move is announced in the live region and the pin stays", async () => {
    setup({});
    fireEvent.click(await screen.findByText("drop outside"));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("This spot is outside pincode 144601");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("no pin")).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });

  it("when the server says outside, Next does not move on", async () => {
    const { onNext } = setup({ "/check-point": [200, { inside: false, precision: "exact" }] });
    fireEvent.click(await screen.findByText("drop inside"));
    fireEvent.click(next());
    expect(await screen.findByText(/outside pincode 144601/)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("keeps a saved pin that is still inside", async () => {
    setup({}, { saved: [75.385, 31.381] });
    expect(await screen.findByText("75.385,31.381")).toBeInTheDocument();
    expect(next()).toBeEnabled();
  });

  it("shows the notice it was sent back with (submit answered 422)", async () => {
    setup({}, { notice: "This spot is outside pincode 144601. Move the pin." });
    expect(await screen.findByRole("status")).toHaveTextContent("Move the pin.");
  });

  it("with no usable start point, Next waits for a pin", async () => {
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        // A polygon away from the centroid: the centre is outside, so there is no start pin.
        "/api/pincodes/144601": [
          200,
          {
            ...area,
            precision: "exact",
            boundary: {
              type: "Polygon",
              coordinates: [
                [
                  [75.0, 31.0],
                  [75.1, 31.0],
                  [75.1, 31.1],
                  [75.0, 31.0],
                ],
              ],
            },
          },
        ],
      }),
    );
    renderWithAuth(<MapStep pincode="144601" onBack={vi.fn()} onNext={vi.fn()} />, {
      auth: authState("verified"),
    });
    expect(await screen.findByText("no pin")).toBeInTheDocument();
    expect(next()).toBeDisabled();
    expect(screen.getByText(/^Tap the map to drop the pin/)).toBeInTheDocument();
  });
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { Report } from "./Report";

vi.mock("@/components/report/PinMap", () => ({ default: () => <div>map</div> }));

const kapurthala = {
  pin: "144601",
  district: "Kapurthala",
  state: "Punjab",
  cityName: "Kapurthala",
  localities: ["Kapurthala", "Sultanpur Road", "Bhulath", "Dhilwan", "Nadala", "Begowal"],
  centroid: { type: "Point", coordinates: [75.38, 31.38] },
  radiusM: 4000,
  boundary: null,
  precision: "approx",
  served: true,
};

function setup(path, table) {
  const fetchSpy = fakeFetch(table);
  vi.stubGlobal("fetch", fetchSpy);
  renderWithAuth(<Report />, { auth: authState("verified"), path, routePath: "/report" });
  return fetchSpy;
}
const next = () => screen.getByRole("button", { name: "Next" });
const field = () => screen.getByLabelText("Your pincode");

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("Report step 1: pincode", () => {
  it("a landing link prefills, looks up, announces the place, and waits for Next", async () => {
    setup("/report?pincode=144601", { "/api/pincodes/144601": [200, kapurthala] });
    expect(screen.getByText("Step 1 of 3: Your pincode")).toBeInTheDocument();
    expect(await screen.findByText("Kapurthala, Punjab")).toBeInTheDocument();
    expect(
      screen.getByText("Covers Kapurthala, Sultanpur Road, Bhulath, Dhilwan and 2 more"),
    ).toBeInTheDocument();
    expect(screen.getByText("Kapurthala, Punjab").closest("[aria-live]")).toBeTruthy();
    expect(screen.getByText("Step 1 of 3: Your pincode")).toBeInTheDocument(); // no auto-advance
    fireEvent.click(next());
    expect(await screen.findByText("Step 2 of 3: Place the pin")).toBeInTheDocument();
  });

  it("looks up only on the 6th digit and keeps the draft in sessionStorage", async () => {
    const fetchSpy = setup("/report", { "/api/pincodes/144601": [200, kapurthala] });
    fireEvent.change(field(), { target: { value: "14460" } });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(next()).toBeDisabled();
    fireEvent.change(field(), { target: { value: "144601" } });
    await screen.findByText("Kapurthala, Punjab");
    expect(next()).toBeEnabled();
    expect(JSON.parse(sessionStorage.getItem("nivaran.report.draft"))).toEqual({
      pincode: "144601",
    });
  });

  it("an unserved pincode shows the waitlist inline; joining confirms and Next stays off", async () => {
    const fetchSpy = setup("/report?pincode=110001", {
      "/api/pincodes/110001": [200, { ...kapurthala, pin: "110001", served: false }],
      "/api/waitlist": [200, { joined: true }],
    });
    expect(await screen.findByText(/We don't cover 110001 yet/)).toBeInTheDocument();
    expect(next()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));
    expect(await screen.findByText("Enter an email like name@example.com.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your email"), {
      target: { value: "asha@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "You're on the waitlist for 110001",
    );
    const call = fetchSpy.mock.calls.find(([u]) => String(u).includes("/api/waitlist"));
    expect(JSON.parse(call[1].body)).toEqual({ pin: "110001", email: "asha@example.com" });
  });

  it("an unknown pincode offers the waitlist too", async () => {
    setup("/report?pincode=999999", {
      "/api/pincodes/999999": [404, { error: { code: "PINCODE_NOT_FOUND", message: "x" } }],
    });
    expect(await screen.findByText(/We couldn't find 999999/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join the waitlist" })).toBeInTheDocument();
  });

  it("a server failure shows an error with Try again, which looks up again", async () => {
    let healthy = false; // the server recovers once the resident taps Try again
    setup("/report?pincode=144601", {
      "/api/pincodes/144601": () =>
        healthy ? [200, kapurthala] : [500, { error: { code: "INTERNAL_ERROR", message: "x" } }],
    });
    const retry = await screen.findByRole("button", { name: "Try again" }, { timeout: 4000 });
    healthy = true;
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText("Kapurthala, Punjab")).toBeInTheDocument());
  });
});

const created = {
  ticketId: "NIV-2026-000007",
  status: "submitted",
  queue: "department",
  department: { id: "d1", name: "Roads" },
  expectedBy: "2026-12-03T11:30:00Z",
  createdAt: "2026-11-26T06:30:00Z",
};

/** Step 3 with a finished draft, filled in and ready to submit. */
function atStep3(table) {
  sessionStorage.setItem(
    "nivaran.report.draft",
    JSON.stringify({ pincode: "144601", lat: 31.381, lng: 75.385, precision: "approx" }),
  );
  const fetchSpy = setup("/report?step=3", { "/api/pincodes/144601": [200, kapurthala], ...table });
  fireEvent.click(screen.getByRole("radio", { name: "Pothole or broken road" }));
  fireEvent.change(screen.getByLabelText("Short title"), { target: { value: "Deep pothole" } });
  fireEvent.change(screen.getByLabelText("What's wrong, and where exactly?"), {
    target: { value: "A deep pothole outside the bus stand." },
  });
  return fetchSpy;
}
const issueCalls = (spy) => spy.mock.calls.filter(([u]) => String(u).includes("/api/issues"));
const submitReport = () => fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

describe("Report step 3: submit", () => {
  it("sends the draft once with an Idempotency-Key, then shows the counterfoil and clears the draft", async () => {
    const inner = atStep3({ "/api/issues": [201, created] });
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    // Hold the submit's answer so the sending state can be seen (and double-tapped).
    const spy = vi.fn(async (url, init) => {
      if (String(url).includes("/api/issues")) await gate;
      return inner(url, init);
    });
    vi.stubGlobal("fetch", spy);
    submitReport();
    const sending = await screen.findByRole("button", { name: "Submitting…" });
    expect(sending).toBeDisabled();
    fireEvent.click(sending); // a double tap does nothing
    release();
    expect(await screen.findByText("NIV-2026-000007")).toBeInTheDocument();
    expect(screen.getByText("Roads")).toBeInTheDocument();
    const calls = issueCalls(spy);
    expect(calls).toHaveLength(1);
    expect(calls[0][1].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(calls[0][1].body)).toEqual({
      pincode: "144601",
      lat: 31.381,
      lng: 75.385,
      category: "pothole",
      title: "Deep pothole",
      description: "A deep pothole outside the bus stand.",
      photos: [],
    });
    expect(sessionStorage.getItem("nivaran.report.draft")).toBeNull();
  });

  it("a retry after a failed send reuses the same key and keeps the draft", async () => {
    let attempt = 0;
    const spy = atStep3({
      "/api/issues": () =>
        ++attempt === 1
          ? [503, { error: { code: "UPSTREAM_UNAVAILABLE", message: "x" } }]
          : [200, created],
    });
    submitReport();
    expect(await screen.findByText(/Your draft is saved/)).toBeInTheDocument();
    submitReport();
    await screen.findByText("NIV-2026-000007");
    const [first, second] = issueCalls(spy);
    expect(second[1].headers["Idempotency-Key"]).toBe(first[1].headers["Idempotency-Key"]);
  });

  it("422 OUTSIDE_PINCODE goes back to the map with the message", async () => {
    atStep3({
      "/api/issues": [422, { error: { code: "OUTSIDE_PINCODE", message: "x" } }],
    });
    submitReport();
    expect(await screen.findByText("Step 2 of 3: Place the pin")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "This spot is outside pincode 144601",
    );
  });

  it("step 3 without a pin in the draft opens the map step instead", async () => {
    sessionStorage.setItem("nivaran.report.draft", JSON.stringify({ pincode: "144601" }));
    setup("/report?step=3", { "/api/pincodes/144601": [200, kapurthala] });
    expect(screen.getByText("Step 2 of 3: Place the pin")).toBeInTheDocument();
  });
});

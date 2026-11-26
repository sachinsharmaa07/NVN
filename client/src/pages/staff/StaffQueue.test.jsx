import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { StaffQueue } from "./StaffQueue";

const staff = {
  id: "u9",
  email: "dev@example.com",
  name: "Dev Singh",
  role: "staff",
  cityId: "c1",
  departmentId: "d1",
  emailVerified: true,
  status: "active",
};
const row = {
  ticketId: "NIV-2026-000042",
  status: "assigned",
  category: "pothole",
  title: "Deep pothole",
  pincode: "144601",
  queue: "department",
  expectedBy: "2026-12-03T11:30:00.000Z",
  slaState: "at_risk",
  onHold: false,
  version: 2,
  createdAt: "2026-11-26T06:30:00.000Z",
  description: "Two feet wide, outside the bus stand.",
  departmentId: "d1",
  location: { lat: 31.38, lng: 75.38 },
  photos: [],
  afterPhotos: [],
  holdReason: null,
};

function setup(table, kind = "staff") {
  const fetchSpy = fakeFetch({
    "/api/staff/issues": [200, { items: [row], nextCursor: null }],
    ...table,
  });
  vi.stubGlobal("fetch", fetchSpy);
  const auth =
    kind === "staff" ? authState("verified", { user: staff, level: 3 }) : authState(kind);
  renderWithAuth(<StaffQueue />, { auth, path: "/staff", routePath: "/staff" });
  return fetchSpy;
}
afterEach(() => vi.unstubAllGlobals());

describe("Staff queue", () => {
  it("a citizen gets the 403 in place and nothing is fetched", () => {
    const spy = setup({}, "verified");
    expect(screen.getByRole("heading", { name: /permission|access/i })).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("opens a row in the drawer and offers only the next status", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Deep pothole/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Change status" }));
    expect(screen.getAllByRole("radio").map((r) => r.value)).toEqual(["in_progress"]);
  });

  it("a 409 says so, keeps the panel and refetches the queue", async () => {
    const spy = setup({
      "/status": [409, { error: { code: "CONFLICT", message: "x" } }],
    });
    fireEvent.click(await screen.findByRole("button", { name: /Deep pothole/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Change status" }));
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));
    const sent = await waitFor(() => {
      const call = spy.mock.calls.find(([u]) => String(u).includes("/status"));
      expect(call).toBeTruthy();
      return call;
    });
    expect(JSON.parse(sent[1].body)).toEqual({ status: "in_progress", version: 2 });
    expect(
      await screen.findByText("Someone updated this issue. Reload to see the latest."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(spy.mock.calls.filter(([u]) => String(u).includes("/api/staff/issues"))).toHaveLength(
        2,
      ),
    );
  });
});

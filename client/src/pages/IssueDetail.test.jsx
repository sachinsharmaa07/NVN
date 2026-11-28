import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { IssueDetail } from "./IssueDetail";

const ID = "NIV-2026-000042";
const resolved = {
  ticketId: ID,
  status: "resolved",
  title: "Deep pothole",
  category: "pothole",
  pincode: "144601",
  queue: "department",
  expectedBy: "2026-12-03T11:30:00.000Z",
  slaState: "on_track",
  onHold: false,
  version: 3,
  createdAt: "2026-11-26T06:30:00.000Z",
  department: { id: "d1", name: "Roads" },
  photos: [{ publicId: "p/before", width: 10, height: 10, url: "https://img/before" }],
  afterPhotos: [{ publicId: "p/after", width: 10, height: 10, url: "https://img/after" }],
  holdReason: null,
  timeline: [
    { status: "submitted", at: "2026-11-26T06:30:00.000Z", role: "citizen", note: null },
    { status: "resolved", at: "2026-11-27T06:30:00.000Z", role: "staff", note: "Filled" },
  ],
};

function setup(table) {
  const fetchSpy = fakeFetch({ [`/api/issues/${ID}`]: [200, resolved], ...table });
  vi.stubGlobal("fetch", fetchSpy);
  renderWithAuth(<IssueDetail />, {
    auth: authState("verified"),
    path: `/issues/${ID}`,
    routePath: "/issues/:ticketId",
  });
  return fetchSpy;
}
const bodyOf = (spy, part) =>
  JSON.parse(spy.mock.calls.find(([u, init]) => String(u).includes(part) && init?.body)[1].body);

// Once answered, "Is it fixed?" folds away: inert at once, removed when its fade ends. jsdom runs no
// CSS transitions, so the test sends the transitionend itself.
function expectPromptFoldsAway() {
  const card = screen
    .getByRole("heading", { name: "Is it fixed?", hidden: true })
    .closest("[inert]");
  expect(card).not.toBeNull();
  fireEvent.transitionEnd(card, { propertyName: "opacity" });
  expect(screen.queryByText("Is it fixed?")).not.toBeInTheDocument();
}

afterEach(() => vi.unstubAllGlobals());

describe("Ticket page", () => {
  it("shows the ticket, both photos and the timeline with roles", async () => {
    setup();
    expect(await screen.findByRole("heading", { name: "Deep pothole" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Photo from the report, photo 1" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Photo after the fix, photo 1" })).toBeInTheDocument();
    expect(screen.getByText(/by Staff$/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Is it fixed?" })).toBeInTheDocument();
  });

  it("Confirm sends the version and shows the server's closed ticket", async () => {
    const spy = setup({ "/confirm": [200, { ...resolved, status: "closed", version: 4 }] });
    fireEvent.click(await screen.findByRole("button", { name: "Yes, it's fixed" }));
    await waitFor(() => expect(screen.getAllByText("Closed").length).toBeGreaterThan(0));
    expect(bodyOf(spy, "/confirm")).toEqual({ version: 3 });
    expectPromptFoldsAway();
  });

  it("Reopen needs 10+ characters before anything is sent", async () => {
    const spy = setup({ "/reopen": [200, { ...resolved, status: "reopened", version: 4 }] });
    fireEvent.click(await screen.findByRole("button", { name: "No, reopen it" }));
    fireEvent.change(screen.getByLabelText("What is still wrong?"), { target: { value: "Still" } });
    fireEvent.click(screen.getByRole("button", { name: "Reopen ticket" }));
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument();
    expect(spy.mock.calls.some(([u]) => String(u).includes("/reopen"))).toBe(false);

    fireEvent.change(screen.getByLabelText("What is still wrong?"), {
      target: { value: "The hole is back after rain" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reopen ticket" }));
    await waitFor(() => expect(screen.getAllByText("Reopened").length).toBeGreaterThan(0));
    expect(bodyOf(spy, "/reopen")).toEqual({ note: "The hole is back after rain", version: 3 });
    expectPromptFoldsAway();
  });

  it("a 409 refetches the ticket", async () => {
    const spy = setup({ "/confirm": [409, { error: { code: "CONFLICT", message: "x" } }] });
    fireEvent.click(await screen.findByRole("button", { name: "Yes, it's fixed" }));
    const reads = () => spy.mock.calls.filter(([u, init]) => String(u).endsWith(ID) && !init?.body);
    await waitFor(() => expect(reads()).toHaveLength(2));
  });
});

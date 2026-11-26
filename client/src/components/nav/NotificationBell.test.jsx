import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { NotificationBell } from "./NotificationBell";

const note = {
  id: "n1",
  type: "status_changed",
  ticketId: "NIV-2026-000042",
  status: "resolved",
  read: false,
  createdAt: "2026-11-27T06:30:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("NotificationBell", () => {
  it("shows the unread count, lists by type, and Mark all as read clears it", async () => {
    let unread = 1;
    const spy = fakeFetch({
      "/api/notifications": () => [
        200,
        { items: [{ ...note, read: !unread }], nextCursor: null, unread },
      ],
      "/read": () => {
        unread = 0;
        return [200, { updated: 1 }];
      },
    });
    vi.stubGlobal("fetch", spy);
    renderWithAuth(<NotificationBell />, { auth: authState("verified") });

    const bell = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.keyDown(bell, { key: "Enter" });
    expect(await screen.findByText("NIV-2026-000042 is now Resolved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark all as read" }));

    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();
    const call = spy.mock.calls.find(([u]) => String(u).includes("/read"));
    expect(JSON.parse(call[1].body)).toEqual({});
    await waitFor(() => expect(screen.queryByTestId("unread-count")).not.toBeInTheDocument());
  });

  it("renders nothing when signed out", () => {
    vi.stubGlobal("fetch", fakeFetch({}));
    const { container } = renderWithAuth(<NotificationBell />, { auth: authState("signedOut") });
    expect(container).toBeEmptyDOMElement();
  });
});

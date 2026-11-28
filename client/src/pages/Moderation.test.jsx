import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { Moderation } from "./Moderation";

afterEach(() => vi.unstubAllGlobals());

const hidden = {
  id: "p1",
  pincode: "144601",
  title: "Call this number for cheap repairs",
  body: "Ring 98xxxxxx for anything.",
  author: "Spammer",
  mine: false,
  status: "hidden",
  commentCount: 0,
  flagCount: 3,
  createdAt: "2026-11-26T06:30:00.000Z",
};

describe("Moderation queue", () => {
  function setup(table) {
    const spy = fakeFetch({
      "/api/moderation/queue": [200, { items: [hidden], nextCursor: null }],
      ...table,
    });
    vi.stubGlobal("fetch", spy);
    renderWithAuth(<Moderation />, { auth: authState("admin"), path: "/moderation" });
    return spy;
  }

  it("lists hidden posts with their report count", async () => {
    setup();
    expect(await screen.findByRole("heading", { name: hidden.title })).toBeInTheDocument();
    expect(screen.getByText("3 reports")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Posts" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("restores at once and sends the action", async () => {
    let restored = false;
    const spy = setup({
      // After the restore the server's queue no longer has the post.
      "/api/moderation/queue": () => [200, { items: restored ? [] : [hidden], nextCursor: null }],
      "/api/moderation/post/p1": () => {
        restored = true;
        return [200, { id: "p1", status: "published", flagCount: 0 }];
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: hidden.title })).not.toBeInTheDocument(),
    );
    const call = spy.mock.calls.find(
      ([u, i]) => String(u).includes("/post/p1") && i?.method === "POST",
    );
    expect(JSON.parse(call[1].body)).toEqual({ action: "restore" });
  });

  it("needs a reason before deleting", async () => {
    const spy = setup({
      "/api/moderation/post/p1": [200, { id: "p1", status: "deleted", flagCount: 3 }],
    });
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("button", { name: "Delete post" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Why is it being deleted?"), {
      target: { value: "Advertising" },
    });
    fireEvent.click(confirm);
    await waitFor(() => {
      const call = spy.mock.calls.find(
        ([u, i]) => String(u).includes("/post/p1") && i?.method === "POST",
      );
      expect(JSON.parse(call[1].body)).toEqual({ action: "delete", reason: "Advertising" });
    });
  });

  it("shows the 403 in place for people without post:moderate", async () => {
    vi.stubGlobal("fetch", fakeFetch({}));
    renderWithAuth(<Moderation />, { auth: authState("verified"), path: "/moderation" });
    expect(await screen.findByRole("heading", { level: 1 })).not.toHaveTextContent("Moderation");
  });
});

describe("Help chat", () => {
  function setup(answer) {
    const spy = fakeFetch({ "/api/chat": answer });
    vi.stubGlobal("fetch", spy);
    renderWithAuth(<ChatPanel />, { auth: authState("verified") });
    return spy;
  }
  const askIt = (text) => {
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  };

  it("shows a ticket answered from the records, and what it couldn't find", async () => {
    setup([
      200,
      {
        kind: "ticket",
        tickets: [
          {
            ticketId: "NIV-2026-000042",
            title: "Deep pothole",
            status: "in_progress",
            expectedBy: "2026-12-03T11:30:00.000Z",
            updatedAt: "2026-11-26T06:30:00.000Z",
            department: "Roads",
          },
        ],
        unknown: ["NIV-2026-999999"],
      },
    ]);
    askIt("where are NIV-2026-000042 and NIV-2026-999999");
    expect(await screen.findByText("Deep pothole")).toBeInTheDocument();
    expect(screen.getByText("Department: Roads")).toBeInTheDocument();
    expect(screen.getByText(/I can't find NIV-2026-999999/)).toBeInTheDocument();
    expect(screen.getByRole("log")).toHaveTextContent("where are NIV-2026-000042");
  });

  it("marks a general answer as guidance, and explains a rate limit", async () => {
    const spy = setup([200, { kind: "general", reply: "Pick Streetlight as the category." }]);
    askIt("Which department fixes streetlights?");
    expect(await screen.findByText("Pick Streetlight as the category.")).toBeInTheDocument();
    expect(screen.getByText("General guidance, not an official answer.")).toBeInTheDocument();
    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({
      message: "Which department fixes streetlights?",
    });
    spy.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "x" } }), {
          status: 429,
        }),
    );
    askIt("again");
    expect(await screen.findByText(/a lot of questions/)).toBeInTheDocument();
  });

  it("sends a suggestion with one tap", async () => {
    setup([200, { kind: "list", tickets: [] }]);
    fireEvent.click(screen.getByRole("button", { name: "Show my complaints" }));
    expect(await screen.findByText("You haven't reported anything yet.")).toBeInTheDocument();
  });
});

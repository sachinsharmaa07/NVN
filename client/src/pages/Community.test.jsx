import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, people, renderWithAuth } from "@/test/renderWithAuth";
import { Community } from "./Community";
import { CommunityPost } from "./CommunityPost";

const PIN = "144601";
const home = { ...people.citizen, defaultPincode: PIN };
const post = {
  id: "p1",
  pincode: PIN,
  title: "Streetlights back on Mall Road",
  body: "All three lights near the market work again.",
  author: "Meera",
  mine: false,
  status: "published",
  commentCount: 2,
  createdAt: "2026-11-26T06:30:00.000Z",
};
const page = (items) => [200, { items, nextCursor: null }];

afterEach(() => vi.unstubAllGlobals());

function renderFeed(table, user = home, path = "/community") {
  const spy = fakeFetch(table);
  vi.stubGlobal("fetch", spy);
  renderWithAuth(<Community />, { auth: authState("verified", { user }), path });
  return spy;
}

describe("Community feed", () => {
  it("shows the home pincode's notices as links with byline and comment count", async () => {
    renderFeed({ "/api/community/posts?pincode=144601": page([post]) });
    const link = await screen.findByRole("link", { name: /Streetlights back on Mall Road/ });
    expect(link).toHaveAttribute("href", "/community/p1");
    expect(within(link).getByText("2 comments")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Neighbourhood notices" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Pincode 144601" })).toBeInTheDocument();
  });

  it("teaches the next step when the feed is empty, and publishes from the composer", async () => {
    const spy = renderFeed({
      "/api/community/posts?pincode": page([]),
      "/api/community/posts": (url, init) =>
        init?.method === "POST" ? [201, { ...post, mine: true }] : page([]),
    });
    expect(await screen.findByText("Nothing posted in 144601 yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Write a post" }));
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: post.title } });
    fireEvent.change(screen.getByLabelText("Post"), { target: { value: post.body } });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    await waitFor(() =>
      expect(spy.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
    );
    const [, init] = spy.mock.calls.find(([, i]) => i?.method === "POST");
    expect(JSON.parse(init.body)).toEqual({ title: post.title, body: post.body });
  });

  it("reads another pincode without offering to post there", async () => {
    renderFeed(
      { "/api/community/posts?pincode=110001": page([post]) },
      home,
      "/community?pincode=110001",
    );
    expect(await screen.findByRole("img", { name: "Pincode 110001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Write a post" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to my pincode" })).toBeInTheDocument();
  });

  it("asks for a home pincode when the profile has none", async () => {
    renderFeed({}, people.citizen);
    expect(
      await screen.findByRole("heading", { name: "Choose a pincode to read its notices" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Read another pincode"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Show notices" }));
    expect(screen.getByText("Enter 6 digits, e.g. 144601.")).toBeInTheDocument();
  });
});

describe("Post page", () => {
  const comments = [
    {
      id: "c1",
      parentId: null,
      body: "Thanks for checking",
      author: "Ravi",
      mine: false,
      createdAt: post.createdAt,
    },
    {
      id: "c2",
      parentId: "c1",
      body: "Confirmed today",
      author: "Meera",
      mine: false,
      createdAt: post.createdAt,
    },
  ];

  function renderPost(table) {
    const spy = fakeFetch({
      "/api/community/posts/p1": [200, post],
      "/comments": page(comments),
      ...table,
    });
    vi.stubGlobal("fetch", spy);
    renderWithAuth(<CommunityPost />, {
      auth: authState("verified", { user: home }),
      path: "/community/p1",
      routePath: "/community/:id",
    });
    return spy;
  }

  it("shows the post and nests replies one level under their comment", async () => {
    renderPost();
    expect(await screen.findByRole("heading", { level: 1, name: post.title })).toBeInTheDocument();
    const reply = await screen.findByText("Confirmed today");
    const parentItem = screen.getByText("Thanks for checking").closest("li");
    expect(parentItem).toContainElement(reply);
  });

  it("shows a new comment at once while it is sent", async () => {
    const spy = renderPost();
    // The POST never answers, so the optimistic comment stays on screen.
    const answer = spy.getMockImplementation();
    spy.mockImplementation((url, init) =>
      init?.method === "POST" ? new Promise(() => {}) : answer(url, init),
    );
    await screen.findByText("Thanks for checking");
    fireEvent.change(screen.getByLabelText("Add a comment"), {
      target: { value: "Still dark at night" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText("Still dark at night")).toBeInTheDocument();
    expect(screen.getByText("Sending…")).toBeInTheDocument();
    await waitFor(() => expect(spy.mock.calls.some(([, i]) => i?.method === "POST")).toBe(true));
  });

  it("sends a report with the chosen reason", async () => {
    const spy = renderPost({ "/api/community/flags": [200, { flagged: true }] });
    await screen.findByRole("heading", { level: 1, name: post.title });
    const [menu] = screen.getAllByRole("button", { name: "Post actions" });
    fireEvent.pointerDown(menu, { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Report" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send report" }));
    await waitFor(() => {
      const call = spy.mock.calls.find(([u]) => String(u).includes("/flags"));
      expect(JSON.parse(call[1].body)).toEqual({
        targetType: "post",
        targetId: "p1",
        reason: "spam",
      });
    });
  });

  it("says when a post is not available", async () => {
    renderPost({
      "/api/community/posts/p1": [404, { error: { code: "NOT_FOUND", message: "x" } }],
    });
    expect(
      await screen.findByText("This post isn't available. It may have been removed."),
    ).toBeInTheDocument();
  });
});

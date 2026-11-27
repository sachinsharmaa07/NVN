import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MINE_KEY, detailKey } from "@/hooks/useIssues";
import { prefetchRoute, resetPrefetch, routes } from "./prefetch";

describe("prefetchRoute", () => {
  const realLoad = routes["/issues"].load;
  let queryClient;
  let api;

  beforeEach(() => {
    resetPrefetch();
    routes["/issues"].load = vi.fn(() => Promise.resolve({}));
    queryClient = new QueryClient();
    api = vi.fn(() => Promise.resolve({ items: [], nextCursor: null }));
  });
  afterEach(() => {
    routes["/issues"].load = realLoad;
  });

  it("imports a page's code once however many times the link is hovered", () => {
    prefetchRoute("/issues", { queryClient, api, signedIn: true });
    prefetchRoute("/issues", { queryClient, api, signedIn: true });
    expect(routes["/issues"].load).toHaveBeenCalledTimes(1);
  });

  it("fetches the first page of My issues once, into the key the page reads", async () => {
    prefetchRoute("/issues", { queryClient, api, signedIn: true });
    prefetchRoute("/issues", { queryClient, api, signedIn: true });
    await vi.waitFor(() => expect(queryClient.getQueryData(MINE_KEY)).toBeDefined());
    expect(api).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[0][0]).toBe("/api/issues/mine?limit=20");
  });

  it("loads code but no data for a signed-out visitor", () => {
    prefetchRoute("/issues", { queryClient, api, signedIn: false });
    expect(routes["/issues"].load).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalled();
  });

  it("tries the download again after a failure", async () => {
    routes["/issues"].load = vi.fn(() => Promise.reject(new Error("offline")));
    prefetchRoute("/issues", { queryClient, api, signedIn: false });
    await Promise.resolve();
    prefetchRoute("/issues", { queryClient, api, signedIn: false });
    expect(routes["/issues"].load).toHaveBeenCalledTimes(2);
  });

  it("ignores paths it does not know", () => {
    expect(() => prefetchRoute("/nope", { queryClient, api, signedIn: true })).not.toThrow();
  });

  it("fetches a ticket into the key its page reads, for any ticket ID", async () => {
    api = vi.fn(() => Promise.resolve({ ticketId: "NIV-2026-000042" }));
    prefetchRoute("/issues/NIV-2026-000042", { queryClient, api, signedIn: true });
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(detailKey("NIV-2026-000042"))).toBeDefined(),
    );
    expect(api.mock.calls[0][0]).toBe("/api/issues/NIV-2026-000042");
    expect(() =>
      prefetchRoute("/issues/not-a-ticket", { queryClient, api, signedIn: true }),
    ).not.toThrow();
    expect(api).toHaveBeenCalledTimes(1);
  });
});

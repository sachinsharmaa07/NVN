import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeFetch } from "@/test/renderWithAuth";
import { authedRequest } from "./authedRequest";

afterEach(() => vi.unstubAllGlobals());

describe("authedRequest", () => {
  it("sends the Bearer token", async () => {
    const fetchSpy = fakeFetch({ "/api/x": [200, { ok: true }] });
    vi.stubGlobal("fetch", fetchSpy);
    const getAuthHeaders = vi.fn(async () => ({ Authorization: "Bearer a" }));
    await expect(authedRequest(getAuthHeaders, "/api/x")).resolves.toEqual({ ok: true });
    expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe("Bearer a");
  });

  it("on 401 asks for a fresh token (cache off) and retries exactly once", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        "/api/x": () =>
          ++calls === 1
            ? [401, { error: { code: "UNAUTHENTICATED", message: "x" } }]
            : [200, { ok: 1 }],
      }),
    );
    const getAuthHeaders = vi.fn(async (o) => ({
      Authorization: o?.cacheMode === "off" ? "Bearer new" : "Bearer old",
    }));
    await expect(authedRequest(getAuthHeaders, "/api/x")).resolves.toEqual({ ok: 1 });
    expect(getAuthHeaders).toHaveBeenNthCalledWith(2, { cacheMode: "off" });
  });

  it("gives up after one retry: a second 401 is thrown, no third call", async () => {
    const fetchSpy = fakeFetch({
      "/api/x": [401, { error: { code: "UNAUTHENTICATED", message: "x" } }],
    });
    vi.stubGlobal("fetch", fetchSpy);
    await expect(authedRequest(async () => ({}), "/api/x")).rejects.toMatchObject({ status: 401 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("treats a failed token fetch as an ended session (UNAUTHENTICATED 401)", async () => {
    vi.stubGlobal("fetch", fakeFetch({}));
    const getAuthHeaders = vi.fn().mockRejectedValue(new Error("login_required"));
    await expect(authedRequest(getAuthHeaders, "/api/x")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });

  it("does not retry other errors", async () => {
    const fetchSpy = fakeFetch({ "/api/x": [403, { error: { code: "FORBIDDEN", message: "x" } }] });
    vi.stubGlobal("fetch", fetchSpy);
    await expect(authedRequest(async () => ({}), "/api/x")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

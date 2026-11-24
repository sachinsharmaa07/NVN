import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet } from "./api";

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("apiGet", () => {
  it("returns the parsed JSON body on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { status: "ok" })));
    await expect(apiGet("/api/health")).resolves.toEqual({ status: "ok" });
  });

  it("normalises the server error body to { code, message, status }", async () => {
    const body = { error: { code: "OUTSIDE_PINCODE", message: "Move the pin inside." } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, body)));

    const error = await apiGet("/api/issues").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "OUTSIDE_PINCODE",
      message: "Move the pin inside.",
      status: 400,
    });
  });

  it("gives non-envelope error bodies an HTTP_<status> code and keeps the body", async () => {
    const body = { status: "degraded", db: "down" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, body)));
    await expect(apiGet("/api/health")).rejects.toMatchObject({
      code: "HTTP_503",
      status: 503,
      data: body,
    });
  });

  it("turns a rejected fetch into NETWORK_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiGet("/api/health")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("turns a non-JSON body into BAD_RESPONSE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    await expect(apiGet("/api/health")).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("aborts after the timeout and reports TIMEOUT", async () => {
    vi.useFakeTimers();
    // A fetch that never answers, but rejects like the real one when its signal aborts.
    const hangingFetch = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    vi.stubGlobal("fetch", hangingFetch);

    const pending = apiGet("/api/health", { timeoutMs: 5000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toMatchObject({ code: "TIMEOUT" });
  });

  it("aborts when the caller's signal aborts (e.g. TanStack Query cancelling)", async () => {
    const hangingFetch = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    vi.stubGlobal("fetch", hangingFetch);
    const caller = new AbortController();
    const pending = apiGet("/api/health", { signal: caller.signal }).catch((e) => e);
    caller.abort();
    expect(await pending).toMatchObject({ code: "ABORTED" });
  });
});

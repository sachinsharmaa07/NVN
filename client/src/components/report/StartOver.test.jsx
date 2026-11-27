import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { StartOver } from "./StartOver";

afterEach(() => vi.unstubAllGlobals());

function setup({
  publicIds = ["nivaran/reports/a", "nivaran/reports/b"],
  answer = [204, null],
} = {}) {
  const fetch = fakeFetch({ "/api/uploads/discard": answer });
  vi.stubGlobal("fetch", fetch);
  const onReset = vi.fn();
  renderWithAuth(<StartOver publicIds={publicIds} onReset={onReset} />, {
    auth: authState("verified"),
  });
  fireEvent.click(screen.getByRole("button", { name: "Start over" }));
  return { fetch, onReset };
}

const discardCalls = (fetch) =>
  fetch.mock.calls.filter(([url]) => String(url).includes("/api/uploads/discard"));

describe("StartOver", () => {
  it("asks first, then discards the uploaded photos in one request and resets", async () => {
    const { fetch, onReset } = setup();
    expect(
      screen.getByRole("alertdialog", { name: "Start this report again?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
    const calls = discardCalls(fetch);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1].body)).toEqual({
      publicIds: ["nivaran/reports/a", "nivaran/reports/b"],
    });
  });

  it("does nothing when the person keeps the report", () => {
    const { fetch, onReset } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Keep my report" }));
    expect(onReset).not.toHaveBeenCalled();
    expect(discardCalls(fetch)).toHaveLength(0);
  });

  it("skips the request when there are no photos", async () => {
    const { fetch, onReset } = setup({ publicIds: [] });
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
    expect(discardCalls(fetch)).toHaveLength(0);
  });

  it("still resets when the photos are already gone (404)", async () => {
    const { onReset } = setup({
      answer: [404, { error: { code: "NOT_FOUND", message: "Not found" } }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
  });
});

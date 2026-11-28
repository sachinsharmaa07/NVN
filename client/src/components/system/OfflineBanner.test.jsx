import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "./OfflineBanner";

function goOffline(offline) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(!offline);
  act(() => window.dispatchEvent(new Event(offline ? "offline" : "online")));
}

describe("OfflineBanner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps an empty status region while online", () => {
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says so when the network drops and clears when it is back", () => {
    render(<OfflineBanner />);
    goOffline(true);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You're offline. Your draft is saved on this phone.",
    );
    goOffline(false);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

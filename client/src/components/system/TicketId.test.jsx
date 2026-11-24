import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { TicketId } from "./TicketId";

// Replace sonner's toast with spies so we can check what the user would be told.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ID = "NIV-2026-000123";

function mockClipboard(writeText) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

describe("TicketId", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    // jsdom has no clipboard; remove ours so tests don't leak into each other.
    delete navigator.clipboard;
  });

  it("shows the full ID", () => {
    render(<TicketId id={ID} />);
    expect(screen.getByText(ID)).toBeInTheDocument();
  });

  it("copies the ID and confirms with a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<TicketId id={ID} />);

    fireEvent.click(screen.getByRole("button", { name: `Copy ticket ID ${ID}` }));

    expect(writeText).toHaveBeenCalledWith(ID);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ticket ID copied"));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("tells the user to copy by hand when the clipboard refuses", async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<TicketId id={ID} />);

    fireEvent.click(screen.getByRole("button", { name: `Copy ticket ID ${ID}` }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't copy the ticket ID. Select it and copy it by hand.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("has no copy button when copyable is false", () => {
    render(<TicketId id={ID} copyable={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

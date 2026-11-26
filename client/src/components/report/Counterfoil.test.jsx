import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { authState, renderWithAuth } from "@/test/renderWithAuth";
import { Counterfoil } from "./Counterfoil";

const issue = {
  ticketId: "NIV-2026-000123",
  department: { id: "d1", name: "Roads" },
  expectedBy: "2026-12-03T11:30:00Z",
  createdAt: "2026-11-26T06:30:00Z",
};
const show = (over) =>
  renderWithAuth(<Counterfoil issue={{ ...issue, ...over }} onReportAnother={vi.fn()} />, {
    auth: authState("verified"),
  });

describe("Counterfoil", () => {
  it("shows the full ticket ID with Copy, the department, and expected-by in IST", () => {
    show();
    expect(screen.getByRole("heading", { name: "Report submitted" })).toHaveFocus();
    expect(screen.getByText("NIV-2026-000123")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy ticket ID NIV-2026-000123" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Roads")).toBeInTheDocument();
    expect(screen.getByText(/^3 Dec(?: 2026)?, 5:00 PM$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Track this issue" })).toHaveAttribute(
      "href",
      "/issues/NIV-2026-000123",
    );
  });

  it("says City triage when no department was chosen", () => {
    show({ department: null });
    expect(screen.getByText(/City triage/)).toBeInTheDocument();
  });
});

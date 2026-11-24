import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlaCountdown } from "./SlaCountdown";

const HOUR = 60 * 60 * 1000;
const startAt = new Date("2026-11-20T00:00:00Z");
const dueAt = new Date(startAt.getTime() + 100 * HOUR);
const at = (hours) => new Date(startAt.getTime() + hours * HOUR);

describe("SlaCountdown", () => {
  it("shows On track and the time left early on", () => {
    render(<SlaCountdown startAt={startAt} dueAt={dueAt} now={at(20)} />);
    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(screen.getByText("3 days 8 hrs left")).toBeInTheDocument();
  });

  it("switches to At risk once 75% of the time is used", () => {
    const { rerender } = render(<SlaCountdown startAt={startAt} dueAt={dueAt} now={at(74)} />);
    expect(screen.queryByText("At risk")).not.toBeInTheDocument();

    rerender(<SlaCountdown startAt={startAt} dueAt={dueAt} now={at(80)} />);
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.getByText("20 hrs left")).toBeInTheDocument();
  });

  it("says Overdue and by how much once past due", () => {
    render(<SlaCountdown startAt={startAt} dueAt={dueAt} now={at(103)} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Overdue by 3 hrs")).toBeInTheDocument();
  });

  it("announces only the state through a polite live region, not the ticking text", () => {
    render(<SlaCountdown startAt={startAt} dueAt={dueAt} now={at(80)} />);
    const badge = screen.getByText("At risk");
    expect(badge.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("20 hrs left").closest("[aria-live]")).toBeNull();
  });

  it("freezes the clock when paused", () => {
    render(<SlaCountdown startAt={startAt} dueAt={dueAt} now={at(90)} pausedAt={at(50)} />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("On hold with 2 days 2 hrs left")).toBeInTheDocument();
  });
});

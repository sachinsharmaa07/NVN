import { render, screen, waitFor } from "@testing-library/react";
import { domMax, LazyMotion, MotionGlobalConfig } from "motion/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusTimeline } from "./StatusTimeline";

const motionPref = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal()),
  useReducedMotion: () => motionPref.reduce,
}));

const STEPS = [
  { status: "submitted", state: "done" },
  { status: "assigned", state: "done" },
  { status: "in_progress", state: "current" },
  { status: "resolved", state: "upcoming" },
];

function renderTimeline(props) {
  return render(
    <LazyMotion features={domMax} strict>
      <StatusTimeline steps={STEPS} {...props} />
    </LazyMotion>,
  );
}

// Instant animations keep the test fast; the end state is what matters.
beforeAll(() => (MotionGlobalConfig.instantAnimations = true));
afterAll(() => (MotionGlobalConfig.instantAnimations = false));
// An observer that never reports: an in-view reveal would leave the steps hidden forever.
beforeEach(() =>
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  vi.unstubAllGlobals();
  motionPref.reduce = false;
});

describe("StatusTimeline", () => {
  it("draws on mount without waiting to scroll into view", async () => {
    renderTimeline();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    await waitFor(() => items.forEach((li) => expect(li.style.opacity).toBe("1")));
  });

  it("shows every step at once with reduced motion", () => {
    motionPref.reduce = true;
    renderTimeline();
    screen.getAllByRole("listitem").forEach((li) => expect(li.style.opacity).not.toBe("0"));
  });

  it("shows every step at once with animate={false}", () => {
    renderTimeline({ animate: false });
    screen.getAllByRole("listitem").forEach((li) => expect(li.style.opacity).not.toBe("0"));
  });
});

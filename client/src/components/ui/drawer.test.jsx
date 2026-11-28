import { motionValue } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { springs } from "@/lib/motion";
import { shouldDismiss, springBack } from "./drawerDrag";

const animate = vi.hoisted(() => vi.fn());
vi.mock("motion/react", async (importOriginal) => ({ ...(await importOriginal()), animate }));

// The drag gesture itself is checked by hand (touch emulation at 360px); this is its decision.
describe("drawer drag to dismiss", () => {
  const height = 400;

  it("closes when dragged down past a quarter of its height", () => {
    expect(shouldDismiss({ offset: 101, velocity: 0, height })).toBe(true);
  });

  it("springs back when dragged less than a quarter", () => {
    expect(shouldDismiss({ offset: 99, velocity: 0, height })).toBe(false);
  });

  it("closes on a fast downward flick even when short", () => {
    expect(shouldDismiss({ offset: 30, velocity: 900, height })).toBe(true);
  });

  it("never closes on an upward drag", () => {
    expect(shouldDismiss({ offset: -50, velocity: -900, height })).toBe(false);
  });

  it("springs back from a 20% drag and closes from a 30% drag (UI.md §6.1)", () => {
    expect(shouldDismiss({ offset: height * 0.2, velocity: 0, height })).toBe(false);
    expect(shouldDismiss({ offset: height * 0.3, velocity: 0, height })).toBe(true);
  });
});

describe("drawer spring back", () => {
  it("returns to the top with springs.gentle", () => {
    animate.mockClear();
    const y = motionValue(80);
    springBack(y, false);
    expect(animate).toHaveBeenCalledWith(y, 0, springs.gentle);
  });

  it("leaves reduced motion to the instant drag transition", () => {
    animate.mockClear();
    springBack(motionValue(80), true);
    expect(animate).not.toHaveBeenCalled();
  });
});

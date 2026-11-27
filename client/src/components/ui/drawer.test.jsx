import { describe, expect, it } from "vitest";
import { shouldDismiss } from "./drawerDrag";

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
});

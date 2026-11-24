import { renderHook } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fadeUp, stagger, useMotionSafe } from "./motion";

/*
 * jsdom has no window.matchMedia. motion reads "(prefers-reduced-motion)" once, then listens for
 * "change" events, so this fake keeps its listeners and lets a test flip the preference.
 */
let prefersReduced = false;
const listeners = new Set();

function setReducedMotion(value) {
  prefersReduced = value;
  listeners.forEach((listener) => listener());
}

beforeAll(() => {
  vi.stubGlobal("matchMedia", (query) => ({
    media: query,
    get matches() {
      return query.includes("reduced-motion") ? prefersReduced : false;
    },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("useMotionSafe", () => {
  it("returns the same variants when the device allows motion", () => {
    setReducedMotion(false);
    const { result } = renderHook(() => useMotionSafe(fadeUp));
    expect(result.current).toBe(fadeUp);
  });

  it("removes movement and makes every transition instant under reduced motion", () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useMotionSafe(fadeUp));

    expect(result.current.hidden).toEqual({ opacity: 0, transition: { duration: 0 } });
    expect(result.current.visible).toEqual({ opacity: 1, transition: { duration: 0 } });
    // The shared object is never changed in place.
    expect(fadeUp.visible.y).toBe(0);
  });

  it("drops the stagger delay under reduced motion", () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useMotionSafe(stagger()));
    expect(result.current.visible.transition).toEqual({ duration: 0 });
  });
});

describe("stagger", () => {
  it("delays items 30ms apart and stops adding delay after 8 items", () => {
    const delayFor = stagger().visible.transition.delayChildren;
    expect(delayFor(0)).toBe(0);
    expect(delayFor(1)).toBeCloseTo(0.03);
    expect(delayFor(7)).toBeCloseTo(0.21);
    expect(delayFor(20)).toBeCloseTo(0.21);
  });
});

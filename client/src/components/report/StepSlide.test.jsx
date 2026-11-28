import { render, screen } from "@testing-library/react";
import { domMax, LazyMotion } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StepBody, StepSlide } from "./StepSlide";

const motionPref = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal()),
  useReducedMotion: () => motionPref.reduce,
}));
afterEach(() => (motionPref.reduce = false));

const view = (step) => (
  <LazyMotion features={domMax} strict>
    <StepSlide step={step}>
      {/* Each step is its own component in the wizard, so its body mounts fresh on a step change. */}
      <StepBody key={step}>
        <p>Step {step}</p>
      </StepBody>
    </StepSlide>
  </LazyMotion>
);
// The motion element is the paragraph's parent; its inline style is where motion starts the step.
const slideOf = (step) => screen.getByText(`Step ${step}`).parentElement;
const unmoved = (el) => expect(["", "none"]).toContain(el.style.transform);

describe("StepSlide", () => {
  it("does not move on the first render (a refresh on ?step=2)", () => {
    render(view(2));
    unmoved(slideOf(2));
    expect(slideOf(2).style.opacity).not.toBe("0");
  });

  it("enters from +16px on Next and from -16px on Back", () => {
    const { rerender } = render(view(1));
    rerender(view(2));
    expect(slideOf(2).style.transform).toBe("translateX(16px)");
    expect(slideOf(2).style.opacity).toBe("0");
    rerender(view(1));
    expect(slideOf(1).style.transform).toBe("translateX(-16px)");
  });

  it("never transforms with reduced motion", () => {
    motionPref.reduce = true;
    const { rerender } = render(view(1));
    rerender(view(2));
    unmoved(slideOf(2));
    rerender(view(1));
    unmoved(slideOf(1));
  });
});

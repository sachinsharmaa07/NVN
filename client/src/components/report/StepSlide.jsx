import * as m from "motion/react-m";
import { createContext, useContext, useState } from "react";
import { durations, easings, useMotionSafe } from "@/lib/motion";

// UI.md §4.2 wizard step: the new step slides 16px in from the direction of travel. No exit animation,
// so the old step leaves at once and nothing overlaps or shifts layout.
const slide = {
  enter: (direction) => ({ opacity: 0, x: 16 * direction }),
  center: { opacity: 1, x: 0, transition: { duration: durations.slow, ease: easings.standard } },
};

const Direction = createContext(0);

/** Wraps the wizard; tracks the direction of travel (1 Next, -1 Back, 0 first render). Renders no DOM. */
export function StepSlide({ step, children }) {
  // The previous step, kept in state (React's "store info from previous renders" pattern), not read from a ref.
  const [seen, setSeen] = useState({ step, from: null });
  if (seen.step !== step) setSeen({ step, from: seen.step });
  const direction = seen.from == null ? 0 : Math.sign(step - seen.from);
  return <Direction value={direction}>{children}</Direction>;
}

/**
 * A step's body, which slides in on mount. The step's WizardFooter stays outside it: it is position: fixed
 * below 1024px, and a transformed ancestor would pin it to this box instead of the viewport mid-slide.
 */
export function StepBody({ className, children }) {
  const direction = useContext(Direction);
  // Reduced motion: transforms dropped and durations zero, so no slide and no visible fade.
  const variants = useMotionSafe(slide);
  return (
    <m.div
      custom={direction}
      variants={variants}
      // First render, or a refresh on ?step=2: already in place.
      initial={direction === 0 ? false : "enter"}
      animate="center"
      className={className}
    >
      {children}
    </m.div>
  );
}

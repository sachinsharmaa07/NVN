import { useReducedMotion } from "motion/react";
import { useMemo } from "react";

/*
 * Motion tokens and variants for the `motion` library (docs/UI.md §4).
 * CSS has the same values as --duration-* and --ease-* in globals.css; this file is the JS copy,
 * because motion takes numbers (seconds) and bezier arrays, not CSS variables.
 * Rule of thumb: motion explains a change the user caused. Nothing here loops or plays on its own.
 */

// Durations in seconds (motion uses seconds, CSS uses ms): 120ms, 200ms, 320ms.
// Nothing a single element does may take longer than `slow`.
export const durations = { fast: 0.12, base: 0.2, slow: 0.32 };

// Cubic-bezier control points, the same curves as --ease-standard / --ease-enter / --ease-exit.
// standard: moves and stays on screen. enter: arriving. exit: leaving (use fast or base, never slow).
export const easings = {
  standard: [0.2, 0, 0, 1],
  enter: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 0.8, 0.15],
};

// Fade in and rise 8px. Used for scroll reveals and list items. Opacity and transform only,
// so nothing around it moves (no layout shift).
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easings.enter },
  },
};

/*
 * Container variants that make children animate one after another.
 * Children need their own `hidden`/`visible` variants (e.g. fadeUp); motion passes the variant
 * name down, so only the container sets initial/animate.
 * UI.md: 30ms between items, at most 8 staggered; item 9 onwards arrives together with item 8.
 * delayChildren can be a function of the child's index, which is how the cap works.
 */
export function stagger(childDelay = 0.03, max = 8) {
  return {
    hidden: {},
    visible: {
      transition: {
        delayChildren: (index) => Math.min(index, max - 1) * childDelay,
      },
    },
  };
}

// Sheet / panel from the bottom edge (chat panel later). `slow` in with the enter curve,
// `base` out with the exit curve (exits never use slow).
export const sheet = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: { duration: durations.slow, ease: easings.enter } },
  exit: { y: "100%", transition: { duration: durations.base, ease: easings.exit } },
};

/*
 * Springs for things the user moves (drawer snap-back, tab indicator), 02-lld "Motion and transition
 * contracts". visualDuration makes a spring read as the same length as the matching duration token.
 * Page transitions are CSS view transitions now (globals.css), not a motion variant.
 */
export const springs = {
  snappy: { type: "spring", visualDuration: durations.base, bounce: 0 },
  gentle: { type: "spring", visualDuration: durations.slow, bounce: 0.1 },
};

// Transform keys that move or resize something. Reduced motion removes them, so content
// simply appears where it will end up.
const TRANSFORM_KEYS = ["x", "y", "z", "scale", "scaleX", "scaleY", "rotate", "skewX", "skewY"];

// One variant (a target object) made instant: no movement, zero duration, no delays or stagger.
function makeInstant(target) {
  if (!target || typeof target !== "object") return target;
  const safe = { ...target };
  for (const key of TRANSFORM_KEYS) delete safe[key];
  safe.transition = { duration: 0 };
  return safe;
}

// Exported for tests and for code outside React. Function variants (that take `custom`)
// are wrapped so their result is made instant too.
export function toInstantVariants(variants) {
  const result = {};
  for (const [name, target] of Object.entries(variants)) {
    result[name] =
      typeof target === "function"
        ? (...args) => makeInstant(target(...args))
        : makeInstant(target);
  }
  return result;
}

/*
 * Returns `variants` unchanged, or an instant version when the user has asked their device for
 * reduced motion (prefers-reduced-motion: reduce). Opacity changes still happen, just with no
 * duration, so content is never stuck hidden. A spring (a transition, not variants) becomes instant.
 *   const variants = useMotionSafe(fadeUp);
 *   const transition = useMotionSafe(springs.snappy);
 */
export function useMotionSafe(variants) {
  // motion's own hook reads the media query (and listens for changes) once per component mount.
  const reduced = useReducedMotion();
  return useMemo(() => {
    if (!reduced) return variants;
    return variants?.type === "spring" ? { duration: 0 } : toInstantVariants(variants);
  }, [reduced, variants]);
}

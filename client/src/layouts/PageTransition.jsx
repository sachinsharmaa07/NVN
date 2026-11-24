import { AnimatePresence, motion } from "motion/react";
import { Suspense, useState } from "react";
import { useLocation, useOutlet } from "react-router";
import { page, useMotionSafe } from "@/lib/motion";
import { PageSkeleton } from "./PageSkeleton";

// The outgoing page is removed at once and invisibly: UI.md §4 says pages have no exit animation.
// (Zero duration, not a fade; pointer-events off so it can never catch a tap.)
const leaveAtOnce = { opacity: 0, pointerEvents: "none", transition: { duration: 0 } };

/*
 * Renders the current page and fades it in, rising 8px, over 200ms when you navigate.
 * - Keyed by pathname: a new path is a new page and animates in. A query change (?step=2) is
 *   the same page and does not.
 * - initial={false}: the first page after a full load just appears. Nothing animates on load.
 * - mode="popLayout": for the instant the old page is leaving, it is taken out of the flow, so the
 *   new page never jumps down below it.
 * - Opacity and transform only, so input is never blocked and nothing reflows.
 * - Suspense shows PageSkeleton while a page's code is still downloading.
 * - Reduced motion: useMotionSafe makes it an instant swap.
 */
export function PageTransition() {
  const { pathname } = useLocation();
  const variants = useMotionSafe(page);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit={leaveAtOnce}
      >
        <Suspense fallback={<PageSkeleton />}>
          <FrozenOutlet />
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

// Keeps the page this wrapper was created for. Without it, the leaving wrapper would re-render
// with the new route's content for a moment, showing the new page twice.
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

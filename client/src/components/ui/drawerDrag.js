// Drag-to-dismiss decision for the bottom drawer (UI.md §6.1): dragged down past a quarter of its height,
// or flicked down fast, it closes; anything less springs back. Testable without a gesture.
import { animate } from "motion/react";
import { springs } from "@/lib/motion";

const DISMISS_FRACTION = 0.25;
const FLICK_VELOCITY = 500; // px/s, a quick downward flick

export function shouldDismiss({ offset, velocity, height }) {
  return offset > height * DISMISS_FRACTION || velocity > FLICK_VELOCITY;
}

// Motion's own release bounce has no visualDuration, so the drawer settles with springs.gentle instead
// (starting this animation stops Motion's). Reduced motion keeps the drawer's instant dragTransition.
export function springBack(y, reduced) {
  if (!reduced) animate(y, 0, springs.gentle);
}

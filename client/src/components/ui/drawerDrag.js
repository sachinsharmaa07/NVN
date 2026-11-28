// Drag-to-dismiss decision for the bottom drawer (UI.md §6.1): dragged down past a quarter of its height,
// or flicked down fast, it closes; anything less springs back. Pure, so it can be tested without a gesture.
const DISMISS_FRACTION = 0.25;
const FLICK_VELOCITY = 500; // px/s, a quick downward flick

export function shouldDismiss({ offset, velocity, height }) {
  return offset > height * DISMISS_FRACTION || velocity > FLICK_VELOCITY;
}

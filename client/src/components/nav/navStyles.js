// Note: in Tailwind v4 `outline-none` sets outline-style to none, so `outline-solid` is needed
// on focus or the 2px outline never shows.
// Focus ring shared by every nav control (UI.md §9: 2px solid ring at full opacity, 2px offset).
// An outline rather than a box-shadow ring, so it still shows on the raised Report tile,
// which uses its ring for the cut-out edge.
export const focusRing =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring";

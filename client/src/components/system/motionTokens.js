/*
 * Motion tokens for the system components, in the units motion/NumberFlow want.
 * Mirrors --duration-* and --ease-* in styles/globals.css (docs/UI.md §4). Durations and easings come from
 * lib/motion.js (one source of truth); this file adds the NumberFlow unit converters.
 */
export { durations, easings } from "@/lib/motion";

// Web Animations API (used by NumberFlow) takes milliseconds and a CSS easing string.
export const toCssEasing = (curve) => `cubic-bezier(${curve.join(", ")})`;
export const toMs = (seconds) => Math.round(seconds * 1000);

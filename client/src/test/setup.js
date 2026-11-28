// Adds DOM matchers such as toBeInTheDocument() to Vitest's expect (jest-dom v8 entry for Vitest).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { loadLanguage, loadPageStrings } from "@/i18n/t";

// Hindi is a lazy chunk in the app; tests that render or check Hindi expect it to be there already.
await loadLanguage("hi");
// Page-only English strings arrive with the first page in the app; tests render pages directly.
await loadPageStrings();

// With globals: false, Testing Library cannot register its own auto-cleanup, so we do it here.
afterEach(() => {
  cleanup();
});

// jsdom has no matchMedia: give every test a default (a phone-sized screen, no preferences).
// A test that needs a desktop width stubs its own with vi.stubGlobal("matchMedia", ...).
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

// Radix Select and menus call browser APIs jsdom lacks.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

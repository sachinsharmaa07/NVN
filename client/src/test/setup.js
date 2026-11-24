// Adds DOM matchers such as toBeInTheDocument() to Vitest's expect (jest-dom v8 entry for Vitest).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With globals: false, Testing Library cannot register its own auto-cleanup, so we do it here.
afterEach(() => {
  cleanup();
});

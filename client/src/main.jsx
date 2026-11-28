import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonts (docs/UI.md §1). Fontsource CSS already uses font-display: swap, and its unicode-range split
// means Devanagari files only download when Hindi text is on screen.
import "@fontsource-variable/anek-devanagari/wght.css";
import "@fontsource/mukta/400.css";
import "@fontsource/mukta/500.css";
import "@fontsource/mukta/600.css";
import "@/styles/globals.css";
import { App } from "@/App";
import { read as guestLanguage } from "@/i18n/guestLanguage";
import { loadLanguage } from "@/i18n/t";

// A visitor who chose Hindi before gets the Hindi chunk before the first paint, so the page never shows
// English first. Everyone else renders at once; a failed load just means English.
loadLanguage(guestLanguage())
  .catch(() => {})
  .then(() =>
    createRoot(document.getElementById("root")).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );

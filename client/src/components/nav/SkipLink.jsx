import { t } from "@/i18n/t";

// First focusable thing on every page (UI.md §9, WCAG 2.4.1). Hidden until a keyboard user
// tabs to it, then jumps focus past the top bar and navigation to <main id="main">.
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-md bg-background px-4 py-3 font-medium text-foreground shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-dialog focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {t("app.skipToContent")}
    </a>
  );
}

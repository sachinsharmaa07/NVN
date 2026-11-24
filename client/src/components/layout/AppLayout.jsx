import { Outlet } from "react-router";
import { ThemeMenu } from "@/components/theme/ThemeMenu";
import { t } from "@/i18n/t";

// Phase 0 shell: skip link, a minimal header and the page. Phase 1 replaces the header with the
// top bar + bottom action bar (mobile) and the sidebar (desktop) from docs/UI.md §5.
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only rounded-md bg-background px-4 py-3 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-dialog focus:ring-2 focus:ring-ring"
      >
        {t("app.skipToContent")}
      </a>
      <header className="sticky top-0 z-sticky border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6 lg:px-8">
          <span className="font-display text-xl font-semibold">{t("app.name")}</span>
          <ThemeMenu />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
    </div>
  );
}

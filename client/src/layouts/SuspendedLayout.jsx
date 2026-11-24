import { Suspense } from "react";
import { Outlet } from "react-router";
import { PageSkeleton } from "./PageSkeleton";
import { t } from "@/i18n/t";

// The minimal frame for /suspended: the wordmark and the page, no navigation. A suspended user
// has nowhere else to go, so the app's menus would only lead to dead ends.
export function SuspendedLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-background">
        <div className="flex h-16 items-center px-4 md:px-6 lg:px-8">
          <span className="font-display text-xl font-semibold text-foreground">
            {t("app.name")}
          </span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

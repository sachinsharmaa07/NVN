import { Suspense, ViewTransition } from "react";
import { Outlet, useLocation } from "react-router";
import { PageSkeleton } from "./PageSkeleton";

/*
 * Page cross-fade with the browser's View Transitions (UI.md §4, 02-lld "Motion and transition contracts").
 * React Router runs every navigation inside startTransition, so React drives document.startViewTransition.
 * - Keyed by pathname: a new path exits and enters, and both get the `page` class, which globals.css
 *   animates (old out in `fast`, new in and up 8px in `base`). A query change (?step=2) is the same key,
 *   so it is an "update", and `default="none"` keeps it still (02-lld). Unkeyed, every wizard step
 *   change would cross-fade the whole page.
 * - Only `main` is inside the boundary; the shell never animates.
 * - Reduced motion: the reduced-motion block in globals.css turns the animations off.
 * - Suspense shows PageSkeleton only on a first load; during a navigation the old page stays until
 *   the new page's code arrives.
 */
export function PageTransition() {
  const { pathname } = useLocation();
  return (
    <ViewTransition key={pathname} default="none" enter="page" exit="page">
      <div>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </div>
    </ViewTransition>
  );
}

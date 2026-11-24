import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { t } from "@/i18n/t";

/*
 * Shown while a page's code downloads (each page is its own file, see app/router.jsx).
 * On a fast connection the page arrives first and nothing flashes: the grey blocks only appear
 * after 200ms (UI.md §6 Skeleton). Screen readers hear "Loading page" straight away.
 */
export function PageSkeleton() {
  const showBlocks = useDelayedFlag(true, 200);
  return (
    <div role="status" className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <span className="sr-only">{t("shell.page.loading")}</span>
      {showBlocks && (
        <div aria-hidden="true" className="flex flex-col gap-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-full max-w-prose" />
          <Skeleton className="mt-4 h-40 w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

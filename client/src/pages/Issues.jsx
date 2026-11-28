import { ClipboardListIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { IssueCard } from "@/components/issues/IssueCard";
import { EmptyState } from "@/components/system/EmptyState";
import { ErrorState } from "@/components/system/ErrorState";
import { PageHeader } from "@/components/system/PageHeader";
import { SkeletonList } from "@/components/system/SkeletonList";
import { Button } from "@/components/ui/button";
import { useMyIssues } from "@/hooks/useIssues";
import { t } from "@/i18n/t";
import { plural } from "@/lib/plural";

function MyIssues() {
  const query = useMyIssues();
  const [announcement, setAnnouncement] = useState("");
  const issues = query.data?.pages.flatMap((p) => p.items) ?? [];

  async function loadMore() {
    const result = await query.fetchNextPage();
    const after = result.data?.pages.flatMap((p) => p.items).length ?? issues.length;
    setAnnouncement(t("issues.mine.loaded", { count: after - issues.length }));
  }

  let body;
  if (query.isPending) {
    // Shaped like the cards that are coming: same grid, same height.
    body = (
      <SkeletonList
        count={4}
        itemClassName="h-32 rounded-lg"
        className="grid gap-3 md:grid-cols-2"
      />
    );
  } else if (query.isError) {
    body = (
      <ErrorState
        variant="inline"
        title={t("issues.mine.error")}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else if (issues.length === 0) {
    body = (
      <EmptyState
        icon={ClipboardListIcon}
        title={t("shell.issues.emptyTitle")}
        hint={t("shell.issues.emptyHint")}
        action={
          <Button asChild>
            <Link to="/report">{t("shell.nav.reportLong")}</Link>
          </Button>
        }
      />
    );
  } else {
    body = (
      // fade-in: the cards take the skeleton's place in the same box, so nothing moves.
      <ul className="fade-in grid gap-3 md:grid-cols-2">
        {issues.map((issue) => (
          <li key={issue.ticketId}>
            <IssueCard issue={issue} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader
        title={t("shell.issues.title")}
        description={t("shell.issues.description")}
        // "3 issues", or "20+ issues" while more pages are still on the server.
        meta={
          issues.length > 0 && (
            <span>
              {query.hasNextPage
                ? t("issues.mine.countMore", { count: issues.length })
                : plural(issues.length, "issues.mine.count")}
            </span>
          )
        }
      />
      {body}
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} loading={query.isFetchingNextPage}>
            {t("issues.mine.loadMore")}
          </Button>
        </div>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

export function Issues() {
  return (
    <RequireAuth>
      <MyIssues />
    </RequireAuth>
  );
}

export default Issues;

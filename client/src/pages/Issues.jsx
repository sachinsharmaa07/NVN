import { ClipboardListIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { IssueCard } from "@/components/issues/IssueCard";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyIssues } from "@/hooks/useIssues";
import { t } from "@/i18n/t";

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
    body = <Skeleton aria-hidden="true" className="h-40 w-full" />;
  } else if (query.isError) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{t("issues.mine.error")}</p>
        <Button variant="secondary" onClick={() => query.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
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
      <ul className="grid gap-3 md:grid-cols-2">
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
      <PageHeader title={t("shell.issues.title")} description={t("shell.issues.description")} />
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

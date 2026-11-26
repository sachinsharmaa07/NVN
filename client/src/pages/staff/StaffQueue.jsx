import { InboxIcon, SearchXIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { IssueDrawer } from "@/components/staff/IssueDrawer";
import { QueueFilters } from "@/components/staff/QueueFilters";
import { QueueCards, QueueTable } from "@/components/staff/QueueList";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useStaffIssues } from "@/hooks/useStaffIssues";
import { t } from "@/i18n/t";

function Queue() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [params, setParams] = useSearchParams();
  const filters = {
    status: params.get("status") ?? "",
    sla: params.get("sla") ?? "",
    category: params.get("category") ?? "",
  };
  const query = useStaffIssues(filters);
  const issues = query.data?.pages.flatMap((p) => p.items) ?? [];
  // The drawer keeps only the ticket ID; the row comes from the cache, so refetches keep it current.
  // When the issue leaves this view (e.g. resolved), the drawer closes.
  const [selected, setSelected] = useState(null);
  const issue = issues.find((i) => i.ticketId === selected) ?? null;
  const [announcement, setAnnouncement] = useState("");

  const setFilters = useCallback(
    (patch) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  async function loadMore() {
    const result = await query.fetchNextPage();
    const after = result.data?.pages.flatMap((p) => p.items).length ?? issues.length;
    setAnnouncement(t("issues.mine.loaded", { count: after - issues.length }));
  }

  const filtered = Boolean(filters.status || filters.sla || filters.category);
  let body;
  if (query.isPending) {
    body = <Skeleton aria-hidden="true" className="h-64 w-full" />;
  } else if (query.isError) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{t("staff.queue.error")}</p>
        <Button variant="secondary" onClick={() => query.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  } else if (issues.length === 0) {
    body = (
      <EmptyState
        icon={filtered ? SearchXIcon : InboxIcon}
        title={filtered ? t("staff.queue.noMatch") : t("staff.queue.empty")}
        hint={filtered ? t("staff.queue.noMatchHint") : t("staff.queue.emptyHint")}
      />
    );
  } else {
    const List = desktop ? QueueTable : QueueCards;
    body = <List issues={issues} onOpen={(i) => setSelected(i.ticketId)} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("staff.queue.title")} description={t("staff.queue.description")} />
      <QueueFilters filters={filters} onChange={setFilters} />
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
      <IssueDrawer
        issue={issue}
        open={Boolean(issue)}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}

// Staff, department heads, city admins and above (issue:read_scope). Others see the 403 in place.
export function StaffQueue() {
  return (
    <RequireAuth verified permission="issue:read_scope">
      <Queue />
    </RequireAuth>
  );
}

export default StaffQueue;

import { InboxIcon, SearchXIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { IssueDrawer } from "@/components/staff/IssueDrawer";
import { QueueFilters } from "@/components/staff/QueueFilters";
import { QueueCard } from "@/components/staff/QueueList";
import { queueColumns } from "@/components/staff/queueColumns";
import { QUEUE_FILTER_KEYS } from "@/components/staff/queueFilterKeys";
import { EmptyState } from "@/components/system/EmptyState";
import { LedgerTable } from "@/components/system/LedgerTable";
import { PageHeader } from "@/components/system/PageHeader";
import { useStaffIssues } from "@/hooks/useStaffIssues";
import { t } from "@/i18n/t";
import { plural } from "@/lib/plural";

function Queue() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(QUEUE_FILTER_KEYS.map((k) => [k, params.get(k) ?? ""]));
  const query = useStaffIssues(filters);
  const issues = query.data?.pages.flatMap((p) => p.items) ?? [];
  // The drawer keeps only the ticket ID; the row comes from the cache, so refetches keep it current.
  // When the issue leaves this view (e.g. resolved), the drawer closes.
  const [selected, setSelected] = useState(null);
  const issue = issues.find((i) => i.ticketId === selected) ?? null;
  // The row button that opened the drawer: focus goes back to it on close.
  const [openedFrom, setOpenedFrom] = useState(null);
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

  function open(row, button) {
    setOpenedFrom(button);
    setSelected(row.ticketId);
  }

  const filtered = QUEUE_FILTER_KEYS.some((k) => filters[k]);
  // Cursors give no total: count what is loaded; "Load more" follows when there is more.
  const countLabel = plural(
    issues.length,
    filters.status ? "staff.queue.count" : "staff.queue.countOpen",
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("staff.queue.title")} description={t("staff.queue.description")} />
      <QueueFilters filters={filters} onChange={setFilters} />
      <LedgerTable
        columns={queueColumns(open)}
        rows={issues}
        getRowKey={(row) => row.ticketId}
        renderCard={(row, isSelected) => (
          <QueueCard issue={row} selected={isSelected} onOpen={open} />
        )}
        caption={t("staff.queue.caption")}
        countLabel={countLabel}
        selectedKey={selected}
        busy={query.isPlaceholderData}
        isLoading={query.isPending}
        isError={query.isError}
        errorTitle={t("staff.queue.error")}
        onRetry={() => query.refetch()}
        empty={
          <EmptyState
            icon={filtered ? SearchXIcon : InboxIcon}
            title={filtered ? t("staff.queue.noMatch") : t("staff.queue.empty")}
            hint={filtered ? t("staff.queue.noMatchHint") : t("staff.queue.emptyHint")}
          />
        }
        hasMore={query.hasNextPage}
        onLoadMore={loadMore}
        loadingMore={query.isFetchingNextPage}
      />
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <IssueDrawer
        issue={issue}
        open={Boolean(issue)}
        onOpenChange={(o) => !o && setSelected(null)}
        onCloseAutoFocus={(e) => {
          // Back to the row that opened it; if that row has left the list, let Radix decide.
          if (openedFrom?.isConnected) {
            e.preventDefault();
            openedFrom.focus();
          }
        }}
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

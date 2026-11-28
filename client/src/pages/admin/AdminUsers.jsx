import { SearchXIcon, UsersIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { RoleChangeDialog } from "@/components/admin/RoleChangeDialog";
import { StatusDialog } from "@/components/admin/StatusDialog";
import { UserFilters } from "@/components/admin/UserFilters";
import { UsersTable } from "@/components/admin/UsersTable";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n/t";

function AdminUsersContent() {
  const { user: actor } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get("q") ?? "",
    role: params.get("role") ?? "",
    status: params.get("status") ?? "",
  };
  const query = useAdminUsers(filters);
  const users = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  // Which dialog is open for whom. `returnFocus` is the Actions button to give focus back to.
  const [dialog, setDialog] = useState(null); // { kind, user, open, seq }
  // seq changes on every opening, so a reopened dialog is a fresh one (no old reason or error).
  const seq = useRef(0);
  const returnFocus = useRef(null);
  const [announcement, setAnnouncement] = useState("");

  // Merge a filter change into the URL; an empty value removes the key. replace: no history spam.
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

  const openDialog = (kind, user, trigger) => {
    returnFocus.current = trigger ?? null;
    setDialog({ kind, user, open: true, seq: ++seq.current });
  };
  const setOpen = (open) => setDialog((d) => d && { ...d, open });

  async function loadMore() {
    const before = users.length;
    const result = await query.fetchNextPage();
    const after = result.data?.pages.flatMap((p) => p.items).length ?? before;
    setAnnouncement(t("admin.users.loaded", { count: after - before }));
  }

  const filtered = Boolean(filters.q || filters.role || filters.status);
  const empty = (
    <EmptyState
      icon={filtered ? SearchXIcon : UsersIcon}
      title={filtered ? t("admin.users.noMatch") : t("admin.users.empty")}
      hint={filtered ? t("admin.users.noMatchHint") : t("admin.users.emptyHint")}
      action={
        filtered && (
          <Button variant="secondary" onClick={() => setFilters({ q: "", role: "", status: "" })}>
            {t("admin.users.clear")}
          </Button>
        )
      }
    />
  );

  const dialogProps = dialog && {
    user: dialog.user,
    open: dialog.open,
    onOpenChange: setOpen,
    onGone: () => query.refetch(),
    returnFocusRef: returnFocus,
  };
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("admin.users.title")} description={t("admin.users.description")} />
      <UserFilters filters={filters} onChange={setFilters} />
      <UsersTable
        users={users}
        actorId={actor.id}
        onAction={openDialog}
        busy={query.isPlaceholderData}
        isLoading={query.isPending}
        isError={query.isError}
        errorTitle={t("admin.users.error")}
        onRetry={() => query.refetch()}
        empty={empty}
        hasMore={query.hasNextPage}
        onLoadMore={loadMore}
        loadingMore={query.isFetchingNextPage}
      />
      {/* Announces new rows to screen readers; focus stays on the Load more button. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {dialog?.kind === "role" && (
        <RoleChangeDialog key={`role-${dialog.seq}`} actor={actor} {...dialogProps} />
      )}
      {(dialog?.kind === "suspend" || dialog?.kind === "reactivate") && (
        <StatusDialog key={`${dialog.kind}-${dialog.seq}`} mode={dialog.kind} {...dialogProps} />
      )}
    </div>
  );
}

// Needs a verified email, the user:read_scope permission and level 2 or higher. Others see the 403 page.
export function AdminUsers() {
  return (
    <RequireAuth verified permission="user:read_scope" minLevel={2}>
      <AdminUsersContent />
    </RequireAuth>
  );
}

export default AdminUsers;

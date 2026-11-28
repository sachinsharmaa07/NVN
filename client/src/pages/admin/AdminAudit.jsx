import { ScrollTextIcon, SearchXIcon } from "lucide-react";
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { AuditFilters } from "@/components/admin/AuditFilters";
import { AuditTable } from "@/components/admin/AuditTable";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { useAudit } from "@/hooks/useAudit";
import { t } from "@/i18n/t";

function AuditContent() {
  const [params, setParams] = useSearchParams();
  const filters = {
    action: params.get("action") ?? "",
    targetType: params.get("targetType") ?? "",
  };
  const query = useAudit(filters);
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];

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

  const filtered = Boolean(filters.action || filters.targetType);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("admin.audit.title")} description={t("admin.audit.description")} />
      <AuditFilters filters={filters} onChange={setFilters} />
      <AuditTable
        rows={rows}
        busy={query.isPlaceholderData}
        isLoading={query.isPending}
        isError={query.isError}
        errorTitle={t("admin.audit.error")}
        onRetry={() => query.refetch()}
        empty={
          <EmptyState
            icon={filtered ? SearchXIcon : ScrollTextIcon}
            title={t(filtered ? "admin.audit.noMatch" : "admin.audit.empty")}
          />
        }
        hasMore={query.hasNextPage}
        onLoadMore={() => query.fetchNextPage()}
        loadingMore={query.isFetchingNextPage}
      />
    </div>
  );
}

// City admins (their city) and super admins (all): audit:read. Others see the 403 page in place.
export function AdminAudit() {
  return (
    <RequireAuth verified permission="audit:read">
      <AuditContent />
    </RequireAuth>
  );
}

export default AdminAudit;

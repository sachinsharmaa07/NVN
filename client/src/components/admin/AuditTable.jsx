import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { actionLabel, shortId, targetLabel } from "@/components/admin/auditText";
import { LedgerTable } from "@/components/system/LedgerTable";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { formatDateTime } from "@/lib/format";
import { roleName } from "@/lib/roles";

// A known action reads as words; one this client doesn't know yet shows its raw code, muted.
function Action({ action }) {
  const label = actionLabel(action);
  return label ? <span>{label}</span> : <span className="text-muted-foreground">{action}</span>;
}

// Target type and a short id, with Copy for the full id (to paste into a search or a support note).
function Target({ row }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(row.targetId);
      toast.success(t("admin.audit.copied"));
    } catch {
      toast.error(t("admin.audit.copyFailed"));
    }
  }
  return (
    <span className="flex items-center gap-1">
      <span>{targetLabel(row.targetType)}</span>
      <span className="text-muted-foreground tabular-nums">{shortId(row.targetId)}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={copy}
        aria-label={t("admin.audit.copyId", { id: row.targetId })}
        className="text-muted-foreground"
      >
        <CopyIcon aria-hidden="true" />
      </Button>
    </span>
  );
}

// Who did it: a role (never a name or email, the server returns none), or the system job's label.
const actorText = (actor) =>
  actor?.type === "system" ? actor.label || t("admin.audit.system") : roleName(actor?.role);

/**
 * The audit feed as a ledger: When (IST), Action, Target, Actor. Newest first, as the server sends it.
 * Below 1024px, one card per change with the same facts.
 */
export function AuditTable({ rows, ...ledger }) {
  const columns = [
    {
      key: "when",
      header: t("admin.audit.colWhen"),
      className: "whitespace-nowrap tabular-nums",
      cell: (row) => formatDateTime(row.at),
    },
    {
      key: "action",
      header: t("admin.audit.colAction"),
      cell: (row) => <Action action={row.action} />,
    },
    { key: "target", header: t("admin.audit.colTarget"), cell: (row) => <Target row={row} /> },
    { key: "actor", header: t("admin.audit.colActor"), cell: (row) => actorText(row.actor) },
  ];

  return (
    <LedgerTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      caption={t("admin.audit.caption")}
      renderCard={(row) => (
        <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatDateTime(row.at)}
          </span>
          <span className="font-medium">
            <Action action={row.action} />
          </span>
          <Target row={row} />
          <span className="text-sm text-muted-foreground">{actorText(row.actor)}</span>
        </div>
      )}
      {...ledger}
    />
  );
}

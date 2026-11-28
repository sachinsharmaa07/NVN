import { IssueSla } from "@/components/issues/IssueCard";
import { categoryLabel, OPEN_STATUSES } from "@/components/issues/issueRules";
import { focusRing } from "@/components/nav/navStyles";
import { formatDuration } from "@/components/system/slaState";
import { StatusBadge } from "@/components/system/StatusBadge";
import { t } from "@/i18n/t";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * The queue as a ledger (UI.md §5.1): the column definitions LedgerTable draws from 1024px. The issue's
 * title is the button that opens the drawer; `onOpen(issue, el)` gets that button so focus can go back
 * to it when the drawer closes. (Kept apart from QueueCard: a file that exports components should not
 * also export plain functions, or fast refresh can't keep its state.)
 */

/** "in 6 h", "overdue by 3 h", or nothing for a paused or finished issue. */
export function dueIn(issue, now = Date.now()) {
  if (issue.onHold || !OPEN_STATUSES.includes(issue.status)) return "";
  const left = new Date(issue.expectedBy).getTime() - now;
  const span = formatDuration(left);
  return left >= 0 ? t("staff.due.in", { span }) : t("staff.due.overdue", { span });
}

// A plain function, not a component: this file exports only functions (see above).
function dueCell(issue) {
  const rel = dueIn(issue);
  return (
    <span className="flex flex-col tabular-nums">
      <span>{formatDateTime(issue.expectedBy)}</span>
      {rel && <span className="text-sm text-muted-foreground">{rel}</span>}
    </span>
  );
}

export function queueColumns(onOpen) {
  return [
    {
      key: "issue",
      header: t("staff.col.issue"),
      cell: (issue) => (
        <button
          type="button"
          onClick={(e) => onOpen(issue, e.currentTarget)}
          className={cn("flex min-h-11 flex-col items-start rounded-md text-left", focusRing)}
        >
          <span className="font-medium text-foreground">{issue.title}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{issue.ticketId}</span>
        </button>
      ),
    },
    {
      key: "status",
      header: t("staff.col.status"),
      cell: (issue) => (
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={issue.status} />
          <IssueSla issue={issue} />
        </div>
      ),
    },
    { key: "category", header: t("staff.col.category"), cell: (i) => categoryLabel(i.category) },
    {
      key: "pincode",
      header: t("staff.col.pincode"),
      cell: (i) => i.pincode,
      className: "tabular-nums",
    },
    { key: "due", header: t("staff.col.due"), align: "right", cell: dueCell },
    {
      key: "reported",
      header: t("staff.col.reported"),
      align: "right",
      cell: (i) => formatDate(i.createdAt),
      className: "tabular-nums",
    },
  ];
}

import { IssueSla } from "@/components/issues/IssueCard";
import { categoryLabel } from "@/components/issues/issueRules";
import { focusRing } from "@/components/nav/navStyles";
import { StatusBadge } from "@/components/system/StatusBadge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/i18n/t";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * The queue in the server's order (expected-by, soonest first). From 1024px a table whose ticket cell
 * is the button that opens the drawer; below, one card per issue with status + SLA on the first line.
 */
export function QueueTable({ issues, onOpen }) {
  return (
    <Table>
      <TableCaption className="sr-only">{t("staff.queue.caption")}</TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t("staff.col.issue")}</TableHead>
          <TableHead>{t("staff.col.status")}</TableHead>
          <TableHead>{t("staff.col.category")}</TableHead>
          <TableHead aria-sort="ascending">{t("staff.col.due")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow key={issue.ticketId}>
            <TableHead scope="row" className="py-3 font-normal">
              <button
                type="button"
                onClick={(e) => onOpen(issue, e.currentTarget)}
                className={cn("flex min-h-11 flex-col items-start rounded-md text-left", focusRing)}
              >
                <span className="font-medium text-foreground">{issue.title}</span>
                <span className="text-sm text-muted-foreground tabular-nums">{issue.ticketId}</span>
              </button>
            </TableHead>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={issue.status} />
                <IssueSla issue={issue} />
              </div>
            </TableCell>
            <TableCell>{categoryLabel(issue.category)}</TableCell>
            <TableCell className="tabular-nums">{formatDateTime(issue.expectedBy)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function QueueCards({ issues, onOpen }) {
  return (
    <ul className="grid gap-3">
      {issues.map((issue) => (
        <li key={issue.ticketId}>
          <button
            type="button"
            onClick={(e) => onOpen(issue, e.currentTarget)}
            className={cn(
              "flex w-full flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left",
              focusRing,
            )}
          >
            <span className="flex flex-wrap gap-2">
              <StatusBadge status={issue.status} />
              <IssueSla issue={issue} />
            </span>
            <span className="font-medium text-foreground">{issue.title}</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {issue.ticketId}, {categoryLabel(issue.category)}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("issues.expectedBy", { date: formatDateTime(issue.expectedBy) })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

import { IssueSla } from "@/components/issues/IssueCard";
import { focusRing } from "@/components/nav/navStyles";
import { StatusBadge } from "@/components/system/StatusBadge";
import { TicketId } from "@/components/system/TicketId";
import { t } from "@/i18n/t";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dueIn } from "./queueColumns";

/**
 * Below 1024px, one card per issue (the table's columns are in queueColumns.jsx). The whole card is the
 * button that opens the drawer; badges first, then the title, ticket + pincode, and when it's due. A
 * container query puts "in 6 h" beside the date once the card is wide enough.
 */
export function QueueCard({ issue, selected, onOpen }) {
  const rel = dueIn(issue);
  return (
    <button
      type="button"
      onClick={(e) => onOpen(issue, e.currentTarget)}
      className={cn(
        "@container flex w-full flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors duration-fast ease-standard",
        selected ? "bg-accent" : "bg-card",
        focusRing,
      )}
    >
      <span className="flex flex-wrap gap-2">
        <StatusBadge status={issue.status} />
        <IssueSla issue={issue} />
      </span>
      <span className="font-medium text-foreground">{issue.title}</span>
      {/* The ID in its display face, as everywhere else; no Copy, since the card is itself a button. */}
      <span className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground tabular-nums">
        <TicketId id={issue.ticketId} size="sm" copyable={false} />
        <span>{issue.pincode}</span>
      </span>
      <span className="flex w-full flex-col text-sm @sm:flex-row @sm:justify-between">
        <span className="tabular-nums">
          {t("issues.expectedBy", { date: formatDateTime(issue.expectedBy) })}
        </span>
        {rel && <span className="text-muted-foreground">{rel}</span>}
      </span>
    </button>
  );
}

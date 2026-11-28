import { Link } from "react-router";
import { SlaBadge } from "@/components/system/SlaBadge";
import { StatusBadge } from "@/components/system/StatusBadge";
import { TicketId } from "@/components/system/TicketId";
import { useNavIntent } from "@/hooks/useNavIntent";
import { t } from "@/i18n/t";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/nav/navStyles";
import { OPEN_STATUSES } from "./issueRules";

/** SLA badge for an issue: paused while on hold, nothing once it has left the open states. */
export function IssueSla({ issue }) {
  if (issue.onHold) return <SlaBadge state="paused" />;
  if (!OPEN_STATUSES.includes(issue.status)) return null;
  return <SlaBadge state={issue.slaState} />;
}

/**
 * One ticket in My issues: the whole card is the link to its tracking page (44px+ target). A container
 * query card: badges first on a narrow card, "Expected by" moves to the right once the card is @md wide.
 * The ticket ID is named for the view transition, so it travels into the ticket page header; hovering
 * or touching the card starts loading that page and its data (useNavIntent).
 */
export function IssueCard({ issue }) {
  const to = `/issues/${issue.ticketId}`;
  const intent = useNavIntent(to);
  const open = OPEN_STATUSES.includes(issue.status);
  return (
    <Link
      to={to}
      {...intent}
      className={cn(
        // before: a dashed rule inside the left edge, the counterfoil's stub line (as on the receipt and ticket).
        "@container relative block rounded-lg border bg-card p-4 pl-5 transition-colors duration-fast ease-standard hover:bg-accent/40",
        "before:absolute before:inset-y-3 before:left-2 before:border-l-2 before:border-dashed before:border-border",
        focusRing,
      )}
    >
      <div className="flex flex-col gap-2 @md:flex-row @md:items-start @md:justify-between @md:gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={issue.status} />
            <IssueSla issue={issue} />
          </div>
          <p className="font-medium text-foreground">{issue.title}</p>
          {/* No Copy button here: the whole card is a link, and a button can't sit inside one. */}
          <TicketId
            id={issue.ticketId}
            size="sm"
            copyable={false}
            transitionName={`ticket-${issue.ticketId}`}
          />
        </div>
        {/* Always a date: when it should be fixed while open, when it was reported once it's closed. */}
        <p className="text-sm text-muted-foreground tabular-nums @md:shrink-0 @md:text-right">
          {open
            ? t("issues.expectedBy", { date: formatDateTime(issue.expectedBy) })
            : t("issues.reportedOn", { date: formatDate(issue.createdAt) })}
        </p>
      </div>
    </Link>
  );
}

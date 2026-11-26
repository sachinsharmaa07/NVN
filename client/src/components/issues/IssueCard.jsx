import { Link } from "react-router";
import { SlaBadge } from "@/components/system/SlaBadge";
import { StatusBadge } from "@/components/system/StatusBadge";
import { t } from "@/i18n/t";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/nav/navStyles";
import { OPEN_STATUSES } from "./issueRules";

/** SLA badge for an issue: paused while on hold, nothing once it has left the open states. */
export function IssueSla({ issue }) {
  if (issue.onHold) return <SlaBadge state="paused" />;
  if (!OPEN_STATUSES.includes(issue.status)) return null;
  return <SlaBadge state={issue.slaState} />;
}

/** One ticket in My issues: the whole card is the link to its tracking page (44px+ target). */
export function IssueCard({ issue }) {
  return (
    <Link
      to={`/issues/${issue.ticketId}`}
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors duration-fast ease-standard hover:bg-accent/40",
        focusRing,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={issue.status} />
        <IssueSla issue={issue} />
      </div>
      <p className="font-medium text-foreground">{issue.title}</p>
      <p className="font-display text-sm tracking-wide text-muted-foreground tabular-nums">
        {issue.ticketId}
      </p>
      {OPEN_STATUSES.includes(issue.status) && (
        <p className="text-sm text-muted-foreground">
          {t("issues.expectedBy", { date: formatDateTime(issue.expectedBy) })}
        </p>
      )}
    </Link>
  );
}

import { ClockIcon, PauseIcon, SearchXIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { IssueSla } from "@/components/issues/IssueCard";
import { OPEN_STATUSES } from "@/components/issues/issueRules";
import { PhotoGrid } from "@/components/issues/PhotoGrid";
import { ResolveCard } from "@/components/issues/ResolvePrompt";
import { CATEGORIES } from "@/components/report/categories";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { StatusBadge } from "@/components/system/StatusBadge";
import { StatusTimeline } from "@/components/system/StatusTimeline";
import { TicketId } from "@/components/system/TicketId";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIssue } from "@/hooks/useIssues";
import { t } from "@/i18n/t";
import { formatDate, formatDateTime } from "@/lib/format";
import { roleName } from "@/lib/roles";

const frame = "mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12";

// Oldest first; the last entry is where the ticket is now. Who did it is a role, never a person.
const stepsOf = (timeline) =>
  timeline.map((entry, index) => ({
    status: entry.status,
    at: entry.role
      ? t("issues.timeline.by", { date: formatDateTime(entry.at), who: roleName(entry.role) })
      : formatDateTime(entry.at),
    note: entry.note,
    state: index === timeline.length - 1 ? "current" : "done",
  }));

const categoryName = (value) => {
  const found = CATEGORIES.find((c) => c.value === value);
  return found ? t(found.label) : null;
};

function NotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      titleAs="h1"
      title={t("issues.detail.notFound")}
      hint={t("issues.detail.notFoundHint")}
      action={
        <Button asChild variant="secondary">
          <Link to="/issues">{t("issues.detail.notFoundAction")}</Link>
        </Button>
      }
    />
  );
}

/**
 * One ticket, one hierarchy (UI.md §7): the title is the only h1; the badges and category sit under it;
 * then the counterfoil strip with the ticket ID (named for the view transition from My issues and the
 * report receipt), "Is it fixed?" when it's the reporter's turn, the deadline, the history, the photos.
 */
function Ticket() {
  const { ticketId } = useParams();
  const query = useIssue(ticketId);

  if (query.isPending) return <Skeleton aria-hidden="true" className="h-96 w-full" />;
  if (query.isError) {
    if (query.error.status === 404 || query.error.status === 400) return <NotFound />;
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{t("issues.detail.error")}</p>
        <Button variant="secondary" onClick={() => query.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const issue = query.data;
  const open = OPEN_STATUSES.includes(issue.status);
  const category = categoryName(issue.category);
  return (
    <>
      <PageHeader
        backTo="/issues"
        backLabel={t("shell.issues.title")}
        title={issue.title}
        meta={
          <>
            <StatusBadge status={issue.status} />
            <IssueSla issue={issue} />
            {category && <span>{category}</span>}
          </>
        }
      />

      {/* The counterfoil again, as the ticket's stub: a dashed edge and the ID in full. */}
      <div className="flex flex-col gap-4 rounded-lg border border-dashed p-4">
        <TicketId id={issue.ticketId} size="md" transitionName={`ticket-${issue.ticketId}`} />
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t("report.done.department")}</dt>
            <dd>{issue.department?.name ?? t("report.done.triage")}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t("issues.detail.reported")}</dt>
            <dd className="tabular-nums">{formatDate(issue.createdAt)}</dd>
          </div>
        </dl>
      </div>

      <ResolveCard issue={issue} />

      <section aria-labelledby="timeline-title" className="flex flex-col gap-4">
        <h2 id="timeline-title" className="font-display text-h3 font-semibold">
          {t("issues.detail.history")}
        </h2>
        {open && !issue.onHold && (
          <p className="flex items-center gap-2 font-medium tabular-nums">
            <ClockIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
            {t("issues.expectedBy", { date: formatDateTime(issue.expectedBy) })}
          </p>
        )}
        {issue.onHold && (
          <p className="flex items-center gap-2 font-medium">
            <PauseIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            {issue.holdReason
              ? t("issues.detail.pausedFor", { reason: issue.holdReason })
              : t("issues.detail.paused")}
          </p>
        )}
        <StatusTimeline steps={stepsOf(issue.timeline ?? [])} />
      </section>

      <div className="flex flex-col gap-6">
        <PhotoGrid
          photos={issue.photos}
          title={t("issues.photos.before")}
          label={t("issues.photos.before")}
        />
        <PhotoGrid
          photos={issue.afterPhotos}
          title={t("issues.photos.after")}
          label={t("issues.photos.after")}
          emptyLabel={t("issues.photos.afterPending")}
        />
      </div>
    </>
  );
}

export function IssueDetail() {
  return (
    <RequireAuth>
      <div className={frame}>
        <Ticket />
      </div>
    </RequireAuth>
  );
}

export default IssueDetail;

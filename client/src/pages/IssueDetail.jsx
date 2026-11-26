import { SearchXIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { IssueSla } from "@/components/issues/IssueCard";
import { OPEN_STATUSES } from "@/components/issues/issueRules";
import { PhotoGrid } from "@/components/issues/PhotoGrid";
import { ResolvePrompt } from "@/components/issues/ResolvePrompt";
import { EmptyState } from "@/components/system/EmptyState";
import { StatusBadge } from "@/components/system/StatusBadge";
import { StatusTimeline } from "@/components/system/StatusTimeline";
import { TicketId } from "@/components/system/TicketId";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIssue } from "@/hooks/useIssues";
import { t } from "@/i18n/t";
import { formatDate, formatDateTime } from "@/lib/format";
import { roleName } from "@/lib/roles";

const frame = "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12";

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

function Ticket() {
  const { ticketId } = useParams();
  const query = useIssue(ticketId);

  if (query.isPending) return <Skeleton aria-hidden="true" className="h-96 w-full" />;
  if (query.isError) {
    if (query.error.status === 404 || query.error.status === 400) {
      return (
        <EmptyState
          icon={SearchXIcon}
          title={t("issues.detail.notFound")}
          hint={t("issues.detail.notFoundHint")}
          action={
            <Button asChild variant="secondary">
              <Link to="/issues">{t("shell.issues.title")}</Link>
            </Button>
          }
        />
      );
    }
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
  return (
    <>
      {/* The counterfoil again, as the ticket's header: perforated top edge and the ID in full. */}
      <header className="flex flex-col gap-4 rounded-lg border border-t-2 border-dashed bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={issue.status} />
          <IssueSla issue={issue} />
        </div>
        <h1 className="font-display text-2xl font-semibold">{issue.title}</h1>
        <TicketId id={issue.ticketId} size="lg" />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("report.done.department")}</dt>
          <dd>{issue.department?.name ?? t("report.done.triage")}</dd>
          <dt className="text-muted-foreground">{t("issues.detail.reported")}</dt>
          <dd className="tabular-nums">{formatDate(issue.createdAt)}</dd>
          {open && (
            <>
              <dt className="text-muted-foreground">{t("report.done.expectedBy")}</dt>
              <dd className="tabular-nums">{formatDateTime(issue.expectedBy)}</dd>
            </>
          )}
          {issue.onHold && issue.holdReason && (
            <>
              <dt className="text-muted-foreground">{t("issues.detail.paused")}</dt>
              <dd>{issue.holdReason}</dd>
            </>
          )}
        </dl>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoGrid
          photos={issue.photos}
          title={t("issues.photos.before")}
          label={t("issues.photos.before")}
        />
        <PhotoGrid
          photos={issue.afterPhotos}
          title={t("issues.photos.after")}
          label={t("issues.photos.after")}
        />
      </div>
      <section aria-labelledby="timeline-title" className="flex flex-col gap-4">
        <h2 id="timeline-title" className="font-display text-lg font-semibold">
          {t("issues.detail.history")}
        </h2>
        <StatusTimeline steps={stepsOf(issue.timeline ?? [])} />
      </section>
      {issue.status === "resolved" && <ResolvePrompt issue={issue} />}
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

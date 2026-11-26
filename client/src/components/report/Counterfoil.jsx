import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { TicketId } from "@/components/system/TicketId";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { formatDate, formatDateTime } from "@/lib/format";

/**
 * The report's receipt (UI.md §1): a counterfoil with a perforated top edge, the ticket ID large in the
 * display font with Copy, and one round postmark beside the date. The heading takes focus on arrival
 * so screen readers hear "Report submitted" right away.
 */
export function Counterfoil({ issue, onReportAnother }) {
  const heading = useRef(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <section
      aria-labelledby="counterfoil-title"
      className="flex flex-col items-center gap-6 rounded-lg border border-t-2 border-dashed bg-card p-6 text-center md:p-8"
    >
      <h2
        id="counterfoil-title"
        ref={heading}
        tabIndex={-1}
        className="font-display text-2xl font-semibold outline-none"
      >
        {t("report.done.title")}
      </h2>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">{t("report.done.yourTicket")}</p>
        <TicketId id={issue.ticketId} size="lg" />
      </div>
      <div className="flex items-center gap-3">
        {/* The postmark holds no words; the date beside it is the text (UI.md §1). */}
        <span
          aria-hidden="true"
          className="size-12 rounded-full border-2 border-postmark ring-2 ring-postmark/40 ring-offset-2 ring-offset-card"
        />
        <p className="text-sm">
          {t("report.done.submittedOn", { date: formatDate(issue.createdAt) })}
        </p>
      </div>
      <dl className="grid w-full max-w-sm grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-sm">
        <dt className="text-muted-foreground">{t("report.done.department")}</dt>
        <dd>{issue.department?.name ?? t("report.done.triage")}</dd>
        <dt className="text-muted-foreground">{t("report.done.expectedBy")}</dt>
        <dd className="tabular-nums">{formatDateTime(issue.expectedBy)}</dd>
      </dl>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link to={`/issues/${issue.ticketId}`}>{t("report.done.track")}</Link>
        </Button>
        <Button variant="outline" size="lg" onClick={onReportAnother}>
          {t("report.done.another")}
        </Button>
      </div>
    </section>
  );
}

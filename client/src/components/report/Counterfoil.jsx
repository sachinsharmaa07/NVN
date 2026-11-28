import * as m from "motion/react-m";
import { Link } from "react-router";
import { TicketId } from "@/components/system/TicketId";
import { Button } from "@/components/ui/button";
import { useNavIntent } from "@/hooks/useNavIntent";
import { t } from "@/i18n/t";
import { formatDate, formatDateTime } from "@/lib/format";
import { durations, springs, useMotionSafe } from "@/lib/motion";

/**
 * The report's receipt (UI.md §1): a counterfoil with a perforated top edge, the ticket ID large in the
 * display font with Copy, and one round postmark that lands beside the date. Everything is centred. Its
 * heading is the page's h1 ("Report submitted", set and focused by Report). The ticket ID carries a
 * view-transition name, so "Track this issue" carries it into the ticket page header.
 */
export function Counterfoil({ issue, onReportAnother }) {
  const ticketPath = `/issues/${issue.ticketId}`;
  const intent = useNavIntent(ticketPath);
  // The stamp lands a beat (120ms) after the receipt appears; under reduced motion it is simply there.
  const land = useMotionSafe({ ...springs.gentle, delay: durations.fast });

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-lg border border-t-2 border-dashed bg-card p-6 text-center md:p-8">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">{t("report.done.yourTicket")}</p>
        <TicketId
          id={issue.ticketId}
          size="xl"
          transitionName={`ticket-${issue.ticketId}`}
          className="justify-center"
        />
      </div>
      <div className="flex items-center gap-3">
        {/* The postmark holds no words; the date beside it is the text (UI.md §1). */}
        <m.span
          aria-hidden="true"
          initial={{ opacity: 0, scale: 1.4, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={land}
          className="size-12 rounded-full border-2 border-postmark ring-2 ring-postmark/40 ring-offset-2 ring-offset-card"
        />
        <p className="text-sm">
          {t("report.done.submittedOn", { date: formatDate(issue.createdAt) })}
        </p>
      </div>
      {/* Centred facts: labels right-aligned, values left-aligned, meeting in the middle. */}
      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-right text-muted-foreground">{t("report.done.department")}</dt>
        <dd className="text-left">{issue.department?.name ?? t("report.done.triage")}</dd>
        <dt className="text-right text-muted-foreground">{t("report.done.expectedBy")}</dt>
        <dd className="text-left tabular-nums">{formatDateTime(issue.expectedBy)}</dd>
      </dl>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link to={ticketPath} {...intent}>
            {t("report.done.track")}
          </Link>
        </Button>
        <Button variant="outline" size="lg" onClick={onReportAnother}>
          {t("report.done.another")}
        </Button>
      </div>
    </section>
  );
}

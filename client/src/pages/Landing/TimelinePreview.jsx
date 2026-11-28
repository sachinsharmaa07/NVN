import { MapPinIcon } from "lucide-react";
import { SlaBadge } from "@/components/system/SlaBadge";
import { StatusTimeline } from "@/components/system/StatusTimeline";
import { TicketId } from "@/components/system/TicketId";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

// MOCK: an example ticket to show what tracking looks like. Not a real report.
// Dates are IST and already in display form (docs/UI.md §8: "21 Nov, 6:00 PM").
const SAMPLE_TICKET_ID = "NIV-2026-004217";
const SAMPLE_STEPS = [
  { status: "submitted", state: "done", key: "submitted", dated: true },
  { status: "assigned", state: "done", key: "assigned", dated: true },
  { status: "in_progress", state: "current", key: "inProgress", dated: true },
  // Not reached yet, so no date.
  { status: "resolved", state: "upcoming", key: "resolved", dated: false },
].map(({ key, dated, ...step }) => ({
  ...step,
  at: dated ? t(`landing.timeline.${key}At`) : undefined,
  note: t(`landing.timeline.${key}Note`),
}));

/** An example ticket: the counterfoil header (ticket ID, what, where, deadline) and its timeline. */
export function TimelinePreview({ className }) {
  return (
    <section
      aria-labelledby="landing-timeline-title"
      className={cn("grid gap-6 lg:grid-cols-5 lg:items-start lg:gap-12", className)}
    >
      <div className="flex flex-col gap-2 lg:col-span-2">
        <h2 id="landing-timeline-title" className="font-display text-2xl font-semibold lg:text-h2">
          {t("landing.timeline.title")}
        </h2>
        <p className="max-w-prose text-muted-foreground">{t("landing.timeline.body")}</p>
      </div>

      <article
        aria-labelledby="landing-timeline-example"
        className="flex w-full max-w-2xl flex-col rounded-lg border bg-card lg:col-span-3 lg:max-w-none"
      >
        {/* Ticket header, separated from the timeline by a perforation-style dashed rule. */}
        <div className="flex flex-col gap-3 border-b-2 border-dashed p-4 md:p-6">
          <p id="landing-timeline-example" className="text-sm text-muted-foreground">
            {t("landing.timeline.exampleLabel")}
          </p>
          <TicketId id={SAMPLE_TICKET_ID} size="lg" />
          <h3 className="font-display text-xl font-semibold">{t("landing.timeline.issueTitle")}</h3>
          <p className="flex items-center gap-2 text-muted-foreground">
            <MapPinIcon aria-hidden="true" className="size-4 shrink-0" />
            {t("landing.timeline.issuePlace")}
          </p>
          {/* SLA line sits above the timeline (docs/UI.md §7). */}
          <div className="flex flex-wrap items-center gap-3">
            <SlaBadge state="on_track" />
            <span className="font-medium">{t("landing.timeline.expectedBy")}</span>
          </div>
        </div>
        <div className="p-4 md:p-6">
          <StatusTimeline steps={SAMPLE_STEPS} />
        </div>
      </article>
    </section>
  );
}

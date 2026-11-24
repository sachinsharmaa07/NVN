import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { SlaCountdown } from "@/components/system/SlaCountdown";
import { StatCard } from "@/components/system/StatCard";
import { StatusTimeline } from "@/components/system/StatusTimeline";
import { TicketId } from "@/components/system/TicketId";
import { t } from "@/i18n/t";
import { Caption, StyleGuideSection } from "./StyleGuideSection";

// Sample data only, for checking the components. Nothing here is real.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-24T06:30:00Z"); // 24 Nov 2026, 12:00 PM IST
const ago = (ms) => new Date(NOW.getTime() - ms);
const ahead = (ms) => new Date(NOW.getTime() + ms);

const COUNTDOWNS = [
  // 1 of 5 days used = 20%.
  { key: "early", startAt: ago(DAY), dueAt: ahead(4 * DAY) },
  // 4 of 5 days used = 80%, so "At risk".
  { key: "late", startAt: ago(4 * DAY), dueAt: ahead(DAY) },
  { key: "overdue", startAt: ago(3 * DAY), dueAt: ago(3 * HOUR) },
  { key: "paused", startAt: ago(2 * DAY), dueAt: ahead(DAY), pausedAt: ago(DAY) },
];
const COUNTDOWN_LABELS = {
  early: "system.styleGuide.countdownEarly",
  late: "system.styleGuide.countdownLate",
  overdue: "system.styleGuide.countdownOverdue",
  paused: "system.styleGuide.countdownPaused",
};

// Display dates are pre-formatted, as formatDateTime() will give them (IST, "24 Nov, 9:15 AM").
const TIMELINE = [
  {
    status: "submitted",
    state: "done",
    at: "22 Nov, 9:15 AM",
    note: "system.styleGuide.noteSubmitted",
  },
  {
    status: "assigned",
    state: "done",
    at: "22 Nov, 11:40 AM",
    note: "system.styleGuide.noteAssigned",
  },
  {
    status: "in_progress",
    state: "current",
    at: "24 Nov, 10:05 AM",
    note: "system.styleGuide.noteInProgress",
  },
  { status: "resolved", state: "upcoming" },
  { status: "closed", state: "upcoming" },
];

export function PageHeaderSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.pageHeader")}>
      <PageHeader
        titleAs="h4"
        title={t("system.styleGuide.headerTitle")}
        description={t("system.styleGuide.headerBody")}
        actions={<Button>{t("system.styleGuide.btnLarge")}</Button>}
      />
    </StyleGuideSection>
  );
}

export function EmptyStateSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.emptyState")}>
      <div className="rounded-lg border bg-card">
        <EmptyState
          titleAs="h4"
          icon={FileText}
          title={t("system.styleGuide.emptyTitle")}
          hint={t("system.styleGuide.emptyHint")}
          action={<Button>{t("system.styleGuide.btnLarge")}</Button>}
        />
      </div>
    </StyleGuideSection>
  );
}

export function TimelineSection() {
  const steps = TIMELINE.map((step) => ({ ...step, note: step.note && t(step.note) }));
  return (
    <StyleGuideSection title={t("system.styleGuide.timeline")}>
      <StatusTimeline steps={steps} />
    </StyleGuideSection>
  );
}

export function CountdownSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.countdown")}>
      <div className="flex flex-col gap-4">
        {COUNTDOWNS.map(({ key, ...props }) => (
          <div key={key} className="flex flex-col gap-1">
            <Caption>{t(COUNTDOWN_LABELS[key])}</Caption>
            <SlaCountdown now={NOW} {...props} />
          </div>
        ))}
      </div>
    </StyleGuideSection>
  );
}

export function TicketSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.ticket")}>
      <div className="flex flex-col gap-2">
        <TicketId id="NIV-2026-000123" />
        <TicketId id="NIV-2026-004871" size="lg" />
      </div>
    </StyleGuideSection>
  );
}

export function StatSection() {
  // Sample numbers, labelled as such on screen through the hint.
  const hint = t("system.styleGuide.statHint");
  return (
    <StyleGuideSection title={t("system.styleGuide.stats")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t("system.styleGuide.statOpen")} value={1284} hint={hint} />
        <StatCard label={t("system.styleGuide.statResolved")} value={152340} hint={hint} />
        <StatCard
          label={t("system.styleGuide.statSlaMet")}
          value={0.86}
          format={{ style: "percent" }}
          hint={hint}
        />
      </div>
    </StyleGuideSection>
  );
}

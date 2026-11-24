import {
  CircleCheck,
  CirclePause,
  CircleX,
  Clock,
  Hourglass,
  Inbox,
  Lock,
  RotateCcw,
  TriangleAlert,
  UserCheck,
  Wrench,
} from "lucide-react";

/*
 * One map from enum value to icon, label key and token classes (docs/UI.md §2.1).
 * StatusBadge, SlaBadge and StatusTimeline all read from here, so a status looks the same everywhere.
 * Class strings are written out in full because Tailwind only generates classes it can find as text.
 */
export const STATUS_META = {
  submitted: {
    icon: Inbox,
    labelKey: "system.status.submitted",
    className: "bg-status-submitted text-status-submitted-foreground",
  },
  assigned: {
    icon: UserCheck,
    labelKey: "system.status.assigned",
    className: "bg-status-assigned text-status-assigned-foreground",
  },
  in_progress: {
    icon: Wrench,
    labelKey: "system.status.inProgress",
    className: "bg-status-in-progress text-status-in-progress-foreground",
  },
  resolved: {
    icon: CircleCheck,
    labelKey: "system.status.resolved",
    className: "bg-status-resolved text-status-resolved-foreground",
  },
  closed: {
    icon: Lock,
    labelKey: "system.status.closed",
    className: "bg-status-closed text-status-closed-foreground",
  },
  reopened: {
    icon: RotateCcw,
    labelKey: "system.status.reopened",
    className: "bg-status-reopened text-status-reopened-foreground",
  },
  rejected: {
    icon: CircleX,
    labelKey: "system.status.rejected",
    className: "bg-status-rejected text-status-rejected-foreground",
  },
};

// "paused" is not an SLA state on the server: it shows when slaPausedAt is set (UI.md §2.1).
export const SLA_META = {
  on_track: {
    icon: Clock,
    labelKey: "system.sla.onTrack",
    className: "bg-sla-on-track text-sla-on-track-foreground",
  },
  at_risk: {
    icon: Hourglass,
    labelKey: "system.sla.atRisk",
    className: "bg-sla-at-risk text-sla-at-risk-foreground",
  },
  breached: {
    icon: TriangleAlert,
    labelKey: "system.sla.breached",
    className: "bg-sla-breached text-sla-breached-foreground",
  },
  paused: {
    icon: CirclePause,
    labelKey: "system.sla.paused",
    className: "bg-sla-paused text-sla-paused-foreground",
  },
};

// Shared badge shape: radius sm, 14px weight-500 text, 14px icon (UI.md §2.1, §3).
export const BADGE_CLASS =
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-sm leading-tight font-medium whitespace-nowrap [&>svg]:size-3.5 [&>svg]:shrink-0";

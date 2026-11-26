import { useState } from "react";
import { IssueSla } from "@/components/issues/IssueCard";
import { categoryLabel, nextStatuses, OPEN_STATUSES } from "@/components/issues/issueRules";
import { PhotoGrid } from "@/components/issues/PhotoGrid";
import { StatusBadge } from "@/components/system/StatusBadge";
import { TicketId } from "@/components/system/TicketId";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useCan } from "@/hooks/useCan";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { t } from "@/i18n/t";
import { formatDateTime } from "@/lib/format";
import { useStaffSubmit } from "@/hooks/useStaffIssues";
import { AssignPanel, HoldPanel, StatusPanel } from "./ActionPanels";

/*
 * Issue quick view for staff (UI.md 6): a Sheet from the right on desktop, a bottom Drawer on phones.
 * `issue` is the row from the cached queue, so after a write or a 409 refetch it is already the latest.
 * Actions open as panels in the same overlay; `panel` is which one.
 */
export function IssueDrawer({ issue, open, onOpenChange }) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [panel, setPanel] = useState("details");
  const back = () => setPanel("details");
  const change = (next) => {
    if (!next) setPanel("details");
    onOpenChange(next);
  };

  const title = issue?.title ?? "";
  const description = issue?.ticketId ?? "";
  const body = issue && (
    <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">
      {panel === "details" && <Details issue={issue} onPanel={setPanel} />}
      {panel === "status" && <StatusPanel issue={issue} onDone={back} />}
      {panel === "assign" && <AssignPanel issue={issue} onDone={back} />}
      {panel === "hold" && <HoldPanel issue={issue} onDone={back} />}
    </div>
  );

  if (desktop) {
    return (
      <Sheet open={open} onOpenChange={change}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">{description}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer open={open} onOpenChange={change}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
}

function Details({ issue, onPanel }) {
  const { user } = useAuth();
  const can = useCan();
  const resume = useStaffSubmit(issue, () => {});
  const isHead = user.role === "dept_head";
  const canStatus = can("issue:update_status") && nextStatuses(issue, user.role).length > 0;
  const canAssign = can("issue:assign") && issue.queue === "triage" && !issue.onHold;
  const canHold = isHead && !issue.onHold && OPEN_STATUSES.includes(issue.status);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={issue.status} />
        <IssueSla issue={issue} />
      </div>
      <TicketId id={issue.ticketId} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("staff.col.category")}</dt>
        <dd>{categoryLabel(issue.category)}</dd>
        <dt className="text-muted-foreground">{t("staff.col.due")}</dt>
        <dd className="tabular-nums">{formatDateTime(issue.expectedBy)}</dd>
        <dt className="text-muted-foreground">{t("staff.detail.pincode")}</dt>
        <dd className="tabular-nums">{issue.pincode}</dd>
        {issue.onHold && (
          <>
            <dt className="text-muted-foreground">{t("issues.detail.paused")}</dt>
            <dd>{issue.holdReason}</dd>
          </>
        )}
      </dl>
      {issue.description && <p className="max-w-prose whitespace-pre-line">{issue.description}</p>}
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
      <div className="flex flex-wrap gap-3">
        {canStatus && <Button onClick={() => onPanel("status")}>{t("staff.action.status")}</Button>}
        {canAssign && (
          <Button variant="secondary" onClick={() => onPanel("assign")}>
            {t("staff.action.assign")}
          </Button>
        )}
        {canHold && (
          <Button variant="outline" onClick={() => onPanel("hold")}>
            {t("staff.action.hold")}
          </Button>
        )}
        {isHead && issue.onHold && (
          <Button
            variant="outline"
            loading={resume.pending}
            disabled={resume.pending}
            onClick={() => resume.submit("resume", {}, t("staff.resume.done"))}
          >
            {t("staff.action.resume")}
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-destructive empty:hidden">
        {resume.error}
      </p>
    </>
  );
}

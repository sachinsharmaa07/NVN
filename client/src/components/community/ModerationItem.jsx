import { CircleCheckIcon, EyeOffIcon, FlagIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/system/StateBadge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n/t";
import { bylineOf } from "./communityText";

const reportsLabel = (n) =>
  n === 0
    ? t("moderation.hiddenByModerator")
    : n === 1
      ? t("moderation.oneReport")
      : t("moderation.reports", { count: n });

// A hidden post is waiting on a decision (neutral); published is fine; deleted is final.
const STATE = {
  hidden: { tone: "neutral", icon: EyeOffIcon },
  published: { tone: "good", icon: CircleCheckIcon },
  deleted: { tone: "bad", icon: Trash2Icon },
};

/** One hidden post or comment: what it says, how many reports, Restore or Delete (with a reason). */
export function ModerationItem({ type, item, onAct, busy }) {
  const reasonId = useId();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const typeName = t(type === "post" ? "moderation.typePost" : "moderation.typeComment");
  const threadId = type === "post" ? item.id : item.postId;

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{bylineOf(item)}</span>
        <span className="flex items-center gap-3">
          {STATE[item.status] && (
            <StateBadge tone={STATE[item.status].tone} icon={STATE[item.status].icon}>
              {t(`moderation.status.${item.status}`)}
            </StateBadge>
          )}
          <span className="flex items-center gap-1.5 tabular-nums">
            <FlagIcon aria-hidden="true" className="size-4" />
            {reportsLabel(item.flagCount)}
          </span>
        </span>
      </div>
      {item.title && <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>}
      <p className="whitespace-pre-line">{item.body}</p>
      {item.pincode && (
        <p className="text-sm text-muted-foreground">
          {t("moderation.inPincode", { pincode: item.pincode })}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="secondary"
          onClick={() => onAct({ id: item.id, action: "restore" })}
          disabled={busy}
        >
          {t("moderation.restore")}
        </Button>
        {/* Marked as the destructive choice (the confirm dialog still guards it). */}
        <Button
          variant="outline"
          className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirming(true)}
          disabled={busy}
        >
          {t("moderation.delete")}
        </Button>
        {threadId && (
          <Button asChild variant="link">
            <Link to={`/community/${threadId}`}>{t("moderation.open")}</Link>
          </Button>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("moderation.deleteTitle", { type: typeName })}</AlertDialogTitle>
            <AlertDialogDescription>{t("moderation.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={reasonId}>{t("moderation.reasonLabel")}</Label>
            <Textarea
              id={reasonId}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={`${reasonId}-hint`}
            />
            <p id={`${reasonId}-hint`} className="text-sm text-muted-foreground">
              {t("moderation.reasonHint")}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("moderation.keep")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3}
              onClick={() => {
                onAct({ id: item.id, action: "delete", reason: reason.trim() });
                setConfirming(false);
              }}
            >
              {t("moderation.confirmDelete", { type: typeName })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

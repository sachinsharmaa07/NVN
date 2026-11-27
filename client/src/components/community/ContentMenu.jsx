import { EllipsisIcon, FlagIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { ResponsiveDialog } from "@/components/system/ResponsiveDialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteContent, useFlag } from "@/hooks/useCommunity";
import { t } from "@/i18n/t";

// Server reason code -> its label key (i18n keys are camelCase).
const REASONS = {
  spam: "spam",
  abuse: "abuse",
  personal_info: "personalInfo",
  off_topic: "offTopic",
  other: "other",
};

/**
 * The "…" menu on a post or comment: Report for other people's content, Delete (behind a confirm) for
 * your own. One overlay at a time: the menu closes before the dialog opens (UI.md §6).
 */
export function ContentMenu({ kind, item, postId, pincode, onDeleted }) {
  const [dialog, setDialog] = useState(null); // "report" | "delete" | null
  const [reason, setReason] = useState("spam");
  const reasonId = useId();
  const flag = useFlag();
  const remove = useDeleteContent(kind, { postId, pincode });
  const isPost = kind === "post";

  // Errors are toasted by the hooks; the dialog stays open so the person can retry.
  async function sendReport() {
    try {
      await flag.mutateAsync({ targetType: kind, targetId: item.id, reason });
      setDialog(null);
    } catch {
      // shown by useFlag
    }
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync(item.id);
      setDialog(null);
      onDeleted?.();
    } catch {
      // shown by useDeleteContent
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("community.post.actions")}>
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.mine ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash2Icon aria-hidden="true" />
              {t(isPost ? "community.post.delete" : "community.comments.delete")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDialog("report")}>
              <FlagIcon aria-hidden="true" />
              {t("community.report.open")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveDialog
        open={dialog === "report"}
        onOpenChange={(open) => !flag.isPending && setDialog(open ? "report" : null)}
        title={t(isPost ? "community.report.titlePost" : "community.report.titleComment")}
        description={t("community.report.description")}
        footer={
          <Button onClick={sendReport} loading={flag.isPending}>
            {t("community.report.submit")}
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={reasonId}>{t("community.report.reasonLabel")}</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id={reasonId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REASONS).map(([r, key]) => (
                <SelectItem key={r} value={r}>
                  {t(`community.report.reason.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ResponsiveDialog>

      <AlertDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !remove.isPending && setDialog(open ? "delete" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(isPost ? "community.post.deleteTitle" : "community.comments.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(isPost ? "community.post.deleteBody" : "community.comments.deleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {t(isPost ? "community.post.keep" : "community.comments.keep")}
            </AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete} loading={remove.isPending}>
              {t(isPost ? "community.post.deleteConfirm" : "community.comments.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

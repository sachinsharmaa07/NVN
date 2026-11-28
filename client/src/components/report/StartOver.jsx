import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDiscardPhotos } from "@/hooks/useDiscardPhotos";
import { t } from "@/i18n/t";

/**
 * "Start over" in the wizard header. Confirms first, then deletes the draft's uploaded photos
 * (one discard request) before `onReset` clears the draft, so nothing is left behind in Cloudinary.
 * If the clean-up itself fails the report is still reset: the photos are unreachable without the draft.
 */
export function StartOver({ publicIds, onReset }) {
  const [open, setOpen] = useState(false);
  const discard = useDiscardPhotos();

  async function confirm() {
    // A failed clean-up doesn't block the reset (see above), so its error is dropped here.
    await discard.mutateAsync(publicIds).catch(() => {});
    setOpen(false);
    onReset();
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !discard.isPending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="w-fit">
          {t("report.startOver.trigger")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("report.startOver.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("report.startOver.body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={discard.isPending}>
            {t("report.startOver.keep")}
          </AlertDialogCancel>
          <Button variant="destructive" loading={discard.isPending} onClick={confirm}>
            {t("report.startOver.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

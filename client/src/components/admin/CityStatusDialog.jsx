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
import { t } from "@/i18n/t";

/**
 * Confirm before pausing or opening a city (02-lld §2). Pausing is the destructive one: a paused city
 * takes no new reports or posts. Not optimistic: the dialog stays open with a spinner until the server
 * answers; `error` is shown in place.
 */
export function CityStatusDialog({ city, open, onOpenChange, onConfirm, pending, error }) {
  if (!city) return null;
  const pausing = city.status === "active";
  const key = pausing ? "admin.cities.pauseDialog" : "admin.cities.openDialog";
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${key}.title`, { city: city.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t(`${key}.body`)}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t(`${key}.cancel`)}</AlertDialogCancel>
          <Button
            variant={pausing ? "destructive" : "default"}
            loading={pending}
            onClick={onConfirm}
          >
            {t(`${key}.confirm`)}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useRef, useState } from "react";
import { toast } from "sonner";
import { adminErrorMessage } from "@/components/admin/adminErrors";
import { REASON_MAX, REASON_MIN } from "@/components/admin/reasonLimits";
import { ReasonField } from "@/components/admin/ReasonField";
import { FieldError } from "@/components/system/FieldError";
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
import { useSetUserStatus } from "@/hooks/useSetUserStatus";
import { t } from "@/i18n/t";

/*
 * Suspend or reactivate: one confirm dialog (AlertDialog, any screen size) with a required reason.
 * mode "suspend" asks to suspend (destructive button); mode "reactivate" asks to reactivate.
 * Pessimistic: stays open with a spinner until the server answers. "Keep ..." is the safe button.
 */
export function StatusDialog({ mode, user, open, onOpenChange, onGone, returnFocusRef }) {
  const suspending = mode === "suspend";
  const name = user.name || user.email;
  const key = suspending ? "admin.suspend" : "admin.reactivate";
  const mutation = useSetUserStatus();
  const reasonRef = useRef(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const length = reason.trim().length;
  const valid = length >= REASON_MIN && length <= REASON_MAX;

  async function submit() {
    setError("");
    try {
      await mutation.mutateAsync({
        id: user.id,
        status: suspending ? "suspended" : "active",
        reason: reason.trim(),
      });
      toast.success(t(`${key}.done`, { name }));
      onOpenChange(false);
    } catch (e) {
      if (e.code === "NOT_FOUND") {
        toast(t("admin.users.gone"));
        onOpenChange(false);
        onGone?.();
        return;
      }
      setError(adminErrorMessage(e, "status"));
    }
  }

  return (
    <AlertDialog
      open={open}
      // Closing is ignored while the request is running.
      onOpenChange={(next) => {
        if (!next && mutation.isPending) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        // Focus starts in the Reason box; on close it returns to the row's Actions button.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          reasonRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef?.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${key}.title`, { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t(`${key}.body`, { name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <ReasonField
          id="status-reason"
          inputRef={reasonRef}
          label={t(`${key}.reason`, { name })}
          value={reason}
          onChange={setReason}
        />
        {error && (
          <div role="alert">
            <FieldError>{error}</FieldError>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>{t(`${key}.cancel`)}</AlertDialogCancel>
          <Button
            variant={suspending ? "destructive" : "default"}
            onClick={submit}
            disabled={!valid}
            loading={mutation.isPending}
          >
            {mutation.isPending ? t(`${key}.confirming`) : t(`${key}.confirm`)}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

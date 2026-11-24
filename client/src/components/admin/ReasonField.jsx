import { FieldError } from "@/components/system/FieldError";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REASON_MAX } from "@/components/admin/reasonLimits";
import { t } from "@/i18n/t";

// The required "reason" box shared by the role and suspend dialogs: visible label, hint with a live
// character count, and an optional error line. `id` makes the label, hint and error line up.
export function ReasonField({ id, label, value, onChange, error, inputRef }) {
  const length = value.trim().length;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={REASON_MAX}
        aria-describedby={`${id}-hint`}
        aria-invalid={Boolean(error) || undefined}
      />
      <p id={`${id}-hint`} className="flex justify-between gap-2 text-sm text-muted-foreground">
        <span>{t("admin.role.reasonHint")}</span>
        <span className="tabular-nums">{t("admin.role.reasonCount", { count: length })}</span>
      </p>
      <FieldError>{error}</FieldError>
    </div>
  );
}

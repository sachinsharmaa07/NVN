import { useState } from "react";
import { NOTE_MIN, nextStatuses } from "@/components/issues/issueRules";
import { PhotoPicker } from "@/components/report/PhotoPicker";
import { usePhotoUploads } from "@/components/report/usePhotoUploads";
import { STATUS_META } from "@/components/system/statusMeta";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useDepartments } from "@/hooks/useDepartments";
import { useStaffSubmit } from "@/hooks/useStaffIssues";
import { t } from "@/i18n/t";

/*
 * The three forms inside the issue drawer (one overlay, never a dialog on top of it: UI.md 6).
 * Each sends the issue's `version`, waits for the server (never optimistic), then calls onDone.
 * A 409 is toasted and the queue refetched by useStaffAction; the message also stays here, announced.
 */
function Panel({ title, onBack, onSubmit, canSubmit, pending, submitLabel, error, children }) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children}
      <p role="status" aria-live="polite" className="text-sm text-destructive empty:hidden">
        {error}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!canSubmit || pending} loading={pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
          {t("staff.action.back")}
        </Button>
      </div>
    </form>
  );
}

function NoteField({ id, label, value, onChange, hint }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} maxLength={500} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatusPanel({ issue, onDone }) {
  const { user } = useAuth();
  const options = nextStatuses(issue, user.role);
  const [status, setStatus] = useState(options[0] ?? "");
  const [note, setNote] = useState("");
  const uploads = usePhotoUploads();
  const { submit, error, pending } = useStaffSubmit(issue, onDone);
  const trimmed = note.trim();
  // The note is optional except to reject; when written it must be 3+ characters (server rule).
  const noteOk = trimmed.length >= NOTE_MIN || (trimmed.length === 0 && status !== "rejected");
  const photosOk = status !== "resolved" || (uploads.publicIds.length > 0 && uploads.ready);

  return (
    <Panel
      title={t("staff.action.status")}
      onBack={onDone}
      pending={pending}
      error={error}
      canSubmit={Boolean(status) && noteOk && photosOk}
      submitLabel={t("staff.status.submit")}
      onSubmit={() =>
        submit(
          "status",
          {
            status,
            ...(trimmed && { note: trimmed }),
            ...(status === "resolved" && { afterPhotoPublicIds: uploads.publicIds }),
          },
          t("staff.status.done", { status: t(STATUS_META[status].labelKey) }),
        )
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("staff.status.to")}</legend>
        {options.map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-3 rounded-md border px-3">
            <input
              type="radio"
              name="next-status"
              value={value}
              checked={status === value}
              onChange={() => setStatus(value)}
              className="size-4 accent-primary"
            />
            {t(STATUS_META[value].labelKey)}
          </label>
        ))}
      </fieldset>
      {status === "resolved" && <PhotoPicker uploads={uploads} />}
      <NoteField
        id="status-note"
        label={status === "rejected" ? t("staff.status.reasonRequired") : t("staff.status.note")}
        hint={t("staff.status.noteHint", { min: NOTE_MIN })}
        value={note}
        onChange={setNote}
      />
    </Panel>
  );
}

export function AssignPanel({ issue, onDone }) {
  const { user } = useAuth();
  const departments = useDepartments(user.cityId ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const { submit, error, pending } = useStaffSubmit(issue, onDone);
  const name = departments.data?.find((d) => d.id === departmentId)?.name;
  return (
    <Panel
      title={t("staff.action.assign")}
      onBack={onDone}
      pending={pending}
      error={error || (departments.isError ? t("staff.assign.loadError") : "")}
      canSubmit={Boolean(departmentId)}
      submitLabel={t("staff.assign.submit")}
      onSubmit={() => submit("assign", { departmentId }, t("staff.assign.done", { name }))}
    >
      <div className="grid gap-2">
        <Label htmlFor="assign-department">{t("staff.assign.department")}</Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger id="assign-department">
            <SelectValue placeholder={t("staff.assign.pick")} />
          </SelectTrigger>
          <SelectContent>
            {(departments.data ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Panel>
  );
}

export function HoldPanel({ issue, onDone }) {
  const [reason, setReason] = useState("");
  const { submit, error, pending } = useStaffSubmit(issue, onDone);
  return (
    <Panel
      title={t("staff.action.hold")}
      onBack={onDone}
      pending={pending}
      error={error}
      canSubmit={reason.trim().length >= NOTE_MIN}
      submitLabel={t("staff.hold.submit")}
      onSubmit={() => submit("hold", { reason: reason.trim() }, t("staff.hold.done"))}
    >
      <NoteField
        id="hold-reason"
        label={t("staff.hold.reason")}
        hint={t("staff.hold.hint")}
        value={reason}
        onChange={setReason}
      />
    </Panel>
  );
}

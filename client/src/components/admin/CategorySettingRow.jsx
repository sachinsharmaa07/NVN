import { useId, useState } from "react";
import { FieldError } from "@/components/system/FieldError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryLabel } from "@/hooks/useCitySettings";
import { t } from "@/i18n/t";

const TRIAGE = "triage"; // Select values must be strings; this one stands for departmentId null
const MAX_HOURS = 24 * 90;
const validHours = (respond, resolve) =>
  [respond, resolve].every((h) => Number.isInteger(h) && h >= 1 && h <= MAX_HOURS) &&
  resolve >= respond;

/** One category: its department (or triage) and its two SLA numbers, saved on its own. */
export function CategorySettingRow({ row, departments, save }) {
  const id = useId();
  const [department, setDepartment] = useState(row.departmentId ?? TRIAGE);
  const [respond, setRespond] = useState(String(row.respondHours));
  const [resolve, setResolve] = useState(String(row.resolveHours));
  const [error, setError] = useState("");
  const isOther = row.category === "other";
  const name = categoryLabel(row.category);
  const saving = save.isPending && save.variables?.category === row.category;

  async function submit(event) {
    event.preventDefault();
    const respondHours = Number(respond);
    const resolveHours = Number(resolve);
    if (!validHours(respondHours, resolveHours)) {
      setError(t("citySettings.hoursError"));
      return;
    }
    setError("");
    try {
      await save.mutateAsync({
        category: row.category,
        departmentId: department === TRIAGE ? null : department,
        respondHours,
        resolveHours,
      });
    } catch {
      setError(t("citySettings.failed"));
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{name}</h2>
        <Badge variant="outline">
          {t(row.hoursFrom === "city" ? "citySettings.fromCity" : "citySettings.fromNational")}
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-dept`}>{t("citySettings.department")}</Label>
        <Select value={department} onValueChange={setDepartment} disabled={isOther}>
          <SelectTrigger id={`${id}-dept`} aria-describedby={isOther ? `${id}-other` : undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TRIAGE}>{t("citySettings.triage")}</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isOther && (
          <p id={`${id}-other`} className="text-sm text-muted-foreground">
            {t("citySettings.otherNote")}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["respond", respond, setRespond, "citySettings.respondHours"],
          ["resolve", resolve, setResolve, "citySettings.resolveHours"],
        ].map(([key, value, set, label]) => (
          <div key={key} className="flex flex-col gap-2">
            <Label htmlFor={`${id}-${key}`}>{t(label)}</Label>
            <Input
              id={`${id}-${key}`}
              inputMode="numeric"
              value={value}
              onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
              aria-describedby={`${id}-hint`}
              aria-invalid={error ? true : undefined}
              className="tabular-nums"
            />
          </div>
        ))}
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {t("citySettings.hoursHint")}
      </p>
      <div role="alert">
        <FieldError>{error}</FieldError>
      </div>
      {/* Visible "Save" stays short on a phone; the name keeps six Save buttons apart for screen readers. */}
      <Button
        type="submit"
        variant="outline"
        className="self-start"
        loading={saving}
        aria-label={saving ? undefined : t("citySettings.save", { category: name })}
      >
        {saving ? t("citySettings.saving") : t("citySettings.saveShort")}
      </Button>
    </form>
  );
}

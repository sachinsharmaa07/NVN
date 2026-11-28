import { useId, useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/system/FieldError";
import { ResponsiveDialog } from "@/components/system/ResponsiveDialog";
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
import { useCreateCity } from "@/hooks/useAdminCities";
import { t } from "@/i18n/t";
import { STATE_CODES } from "@/lib/stateCodes";

// The server's own rules (server/src/validators/cityAdmin.js), checked here first for a quick answer.
const CODE = /^[A-Z0-9][A-Z0-9-]{1,39}$/;
const problemsOf = ({ name, code, stateCode }) => ({
  name: name.trim().length < 2 || name.trim().length > 100 ? t("admin.cityForm.nameError") : "",
  code: CODE.test(code) ? "" : t("admin.cityForm.codeError"),
  stateCode: stateCode ? "" : t("admin.cityForm.stateError"),
});

/**
 * "Add city": name, code and state. A new city starts as onboarding (paused) with the default
 * departments; `onCreated` lets the page switch to the Onboarding tab. A 409 means the code is taken,
 * shown on the code field. A Dialog on desktop, a draggable Drawer on phones (ResponsiveDialog).
 */
export function CityFormDialog({ open, onOpenChange, onCreated }) {
  const id = useId();
  const create = useCreateCity();
  const [fields, setFields] = useState({ name: "", code: "", stateCode: "" });
  const [problems, setProblems] = useState({});
  const [formError, setFormError] = useState("");
  const set = (key) => (value) => setFields((f) => ({ ...f, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    const found = problemsOf(fields);
    setProblems(found);
    if (Object.values(found).some(Boolean)) return;
    try {
      await create.mutateAsync({ ...fields, name: fields.name.trim() });
      toast.success(t("admin.cityForm.created"));
      onOpenChange(false);
      onCreated?.();
    } catch (error) {
      if (error.status === 409) setProblems({ code: t("admin.cityForm.codeTaken") });
      else setFormError(error.message);
    }
  }

  const describe = (key) => (problems[key] ? `${id}-${key}-error` : undefined);
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !create.isPending && onOpenChange(next)}
      title={t("admin.cityForm.title")}
      description={t("admin.cityForm.description")}
      footer={
        <>
          <Button type="submit" form={`${id}-form`} loading={create.isPending}>
            {t("admin.cityForm.submit")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>{t("admin.cityForm.name")}</Label>
          <Input
            id={`${id}-name`}
            value={fields.name}
            maxLength={100}
            onChange={(e) => set("name")(e.target.value)}
            aria-invalid={Boolean(problems.name) || undefined}
            aria-describedby={describe("name")}
          />
          <FieldError id={`${id}-name-error`}>{problems.name}</FieldError>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-code`}>{t("admin.cityForm.code")}</Label>
          <Input
            id={`${id}-code`}
            value={fields.code}
            maxLength={40}
            autoCapitalize="characters"
            // Codes are upper case on the server; typing in any case is fine.
            onChange={(e) => set("code")(e.target.value.toUpperCase().replace(/\s/g, ""))}
            aria-invalid={Boolean(problems.code) || undefined}
            aria-describedby={`${id}-code-hint ${describe("code") ?? ""}`.trim()}
            className="tabular-nums"
          />
          <p id={`${id}-code-hint`} className="text-sm text-muted-foreground">
            {t("admin.cityForm.codeHint")}
          </p>
          <FieldError id={`${id}-code-error`}>{problems.code}</FieldError>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-state`}>{t("admin.cityForm.state")}</Label>
          <Select value={fields.stateCode} onValueChange={set("stateCode")}>
            <SelectTrigger
              id={`${id}-state`}
              aria-invalid={Boolean(problems.stateCode) || undefined}
              aria-describedby={describe("stateCode")}
            >
              <SelectValue placeholder={t("admin.cityForm.statePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {STATE_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id={`${id}-stateCode-error`}>{problems.stateCode}</FieldError>
        </div>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
      </form>
    </ResponsiveDialog>
  );
}

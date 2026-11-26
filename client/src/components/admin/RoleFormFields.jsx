import { InfoIcon } from "lucide-react";
import { ReasonField } from "@/components/admin/ReasonField";
import { ScopeFields } from "@/components/admin/ScopeFields";
import { FieldError } from "@/components/system/FieldError";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n/t";
import { roleName } from "@/lib/roles";

// The fields of the role dialog: new role, the scope it needs, the reason, the MFA note.
// All state lives in RoleChangeDialog; this only draws it.
export function RoleFormFields({
  name,
  options,
  form,
  setForm,
  needs,
  needsMfa,
  cities,
  cityQuery,
  onCityQuery,
  departments,
  cityFixed,
  fieldErrors,
  roleRef,
}) {
  const needed = [
    needs.city && t("admin.role.city"),
    needs.department && t("admin.role.department"),
    needs.state && t("admin.role.state"),
  ].filter(Boolean);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="role-new">{t("admin.role.new")}</Label>
        <Select value={form.role} onValueChange={(role) => set({ role })}>
          <SelectTrigger id="role-new" ref={roleRef}>
            <SelectValue placeholder={t("admin.role.pick")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((r) => (
              <SelectItem key={r} value={r}>
                {roleName(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{fieldErrors.role && t("errors.common.validation")}</FieldError>
      </div>
      {/* Polite live region: says which scope fields appeared after choosing a role. */}
      <p aria-live="polite" className="sr-only">
        {form.role &&
          (needed.length
            ? t("admin.role.scopeNeeds", { fields: needed.join(", ") })
            : t("admin.role.scopeNone"))}
      </p>
      <ScopeFields
        needs={needs}
        scope={form}
        onChange={set}
        cities={cities.data}
        cityQuery={cityQuery}
        onCityQuery={onCityQuery}
        departments={departments.data}
        cityFixed={cityFixed}
      />
      {needs.department && departments.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("admin.role.noDepartments")}</p>
      )}
      <ReasonField
        id="role-reason"
        label={t("admin.role.reason")}
        value={form.reason}
        onChange={(reason) => set({ reason })}
        error={fieldErrors.reason && t("admin.role.reasonError")}
      />
      {needsMfa && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("admin.role.mfaNote", { name })}
        </p>
      )}
    </div>
  );
}

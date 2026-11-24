import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n/t";
import { STATE_CODES } from "@/lib/stateCodes";

// A visible label above a control (UI.md §6: no placeholder-only labels).
function Field({ id, label, children }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/*
 * The scope pickers of the role dialog. Only the fields the chosen role needs are shown
 * (roleNeeds: moderator/city_admin -> City; staff/dept_head -> City + Department; state_officer ->
 * State). A city admin's city is fixed, so it is plain text, not a picker.
 * `scope` = { cityId, departmentId, stateCode }; onChange(patch) merges a change.
 */
export function ScopeFields({ needs, scope, onChange, cities = [], departments = [], cityFixed }) {
  const cityName = cities.find((c) => c.id === scope.cityId)?.name;

  // Changing the city invalidates the department that belonged to the old one.
  const pickCity = (cityId) => onChange({ cityId, departmentId: "" });

  return (
    <>
      {needs.city && (
        <Field id={cityFixed ? undefined : "scope-city"} label={t("admin.role.city")}>
          {cityFixed ? (
            <p className="min-h-11 py-2.5">{cityName || scope.cityId}</p>
          ) : (
            <Select value={scope.cityId} onValueChange={pickCity}>
              <SelectTrigger id="scope-city">
                <SelectValue placeholder={t("admin.role.pick")} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
      {needs.department && (
        <Field id="scope-department" label={t("admin.role.department")}>
          <Select
            value={scope.departmentId}
            onValueChange={(departmentId) => onChange({ departmentId })}
            disabled={!scope.cityId}
          >
            <SelectTrigger id="scope-department">
              <SelectValue placeholder={t("admin.role.pick")} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {needs.state && (
        <Field id="scope-state" label={t("admin.role.state")}>
          <Select value={scope.stateCode} onValueChange={(stateCode) => onChange({ stateCode })}>
            <SelectTrigger id="scope-state">
              <SelectValue placeholder={t("admin.role.pick")} />
            </SelectTrigger>
            <SelectContent>
              {STATE_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </>
  );
}

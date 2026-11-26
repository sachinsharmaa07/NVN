import { useState } from "react";
import { Input } from "@/components/ui/input";
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
 * The city list is a search (`cityQuery`): the chosen city stays in the list after the search moves on.
 */
export function ScopeFields({
  needs,
  scope,
  onChange,
  cities = [],
  departments = [],
  cityFixed,
  cityQuery = "",
  onCityQuery,
}) {
  const [picked, setPicked] = useState(null);
  const options =
    picked && picked.id === scope.cityId && !cities.some((c) => c.id === picked.id)
      ? [picked, ...cities]
      : cities;
  const cityName = options.find((c) => c.id === scope.cityId)?.name;

  // Changing the city invalidates the department that belonged to the old one.
  const pickCity = (cityId) => {
    setPicked(options.find((c) => c.id === cityId) ?? null);
    onChange({ cityId, departmentId: "" });
  };

  return (
    <>
      {needs.city && (
        <Field id={cityFixed ? undefined : "scope-city"} label={t("admin.role.city")}>
          {cityFixed ? (
            <p className="min-h-11 py-2.5">{cityName || scope.cityId}</p>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="scope-city-search" className="text-sm text-muted-foreground">
                {t("admin.role.citySearch")}
              </Label>
              <Input
                id="scope-city-search"
                type="search"
                value={cityQuery}
                onChange={(e) => onCityQuery?.(e.target.value)}
                autoComplete="off"
              />
              <Select value={scope.cityId} onValueChange={pickCity}>
                <SelectTrigger id="scope-city">
                  <SelectValue placeholder={t("admin.role.pick")} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

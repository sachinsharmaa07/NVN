import { useId, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { CategorySettingRow } from "@/components/admin/CategorySettingRow";
import { DepartmentsSection } from "@/components/admin/DepartmentsSection";
import { PageHeader } from "@/components/system/PageHeader";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useCities } from "@/hooks/useCities";
import { useCitySettings, useSaveCategory } from "@/hooks/useCitySettings";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { t } from "@/i18n/t";

/** A super admin configures any city, so they pick one first; a city admin always sees their own. */
function CityPicker({ value, onChange }) {
  const id = useId();
  const [q, setQ] = useState("");
  const cities = useCities({ q: useDebouncedValue(q) });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-q`}>{t("citySettings.searchCity")}</Label>
        <Input id={`${id}-q`} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-city`}>{t("citySettings.pickCity")}</Label>
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger id={`${id}-city`}>
            <SelectValue placeholder={t("citySettings.pickCityHint")} />
          </SelectTrigger>
          <SelectContent>
            {(cities.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Settings() {
  const { user } = useAuth();
  const isRoot = user?.role === "super_admin";
  const [cityId, setCityId] = useState(null);
  const query = useCitySettings(isRoot ? cityId : null, { enabled: !isRoot || Boolean(cityId) });
  const save = useSaveCategory(isRoot ? cityId : null);
  const data = query.data;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader
        title={t("citySettings.title")}
        description={
          data
            ? t("citySettings.description", { city: data.city.name })
            : t("citySettings.descriptionNoCity")
        }
      />
      {isRoot && <CityPicker value={cityId} onChange={setCityId} />}
      {query.isLoading && <Skeleton aria-hidden="true" className="h-64 w-full" />}
      {query.isError && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{t("citySettings.error")}</p>
          <Button variant="secondary" onClick={() => query.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      )}
      {data && (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.categories.map((row) => (
            <CategorySettingRow
              key={`${data.city.id}-${row.category}`}
              row={row}
              departments={data.departments}
              save={save}
            />
          ))}
        </div>
      )}
      {data && <DepartmentsSection cityId={data.city.id} sendCityId={isRoot} />}
    </div>
  );
}

export function CitySettings() {
  return (
    <RequireAuth permission="user:promote">
      <Settings />
    </RequireAuth>
  );
}

export default CitySettings;

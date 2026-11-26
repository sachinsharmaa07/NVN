import { CATEGORIES } from "@/components/report/categories";
import { SLA_META, STATUS_META } from "@/components/system/statusMeta";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n/t";

const ALL = "all"; // Radix Select cannot hold an empty value

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => [value, m.labelKey]);
const SLA_OPTIONS = ["on_track", "at_risk", "breached"].map((v) => [v, SLA_META[v].labelKey]);
const CATEGORY_OPTIONS = CATEGORIES.map((c) => [c.value, c.label]);

/** Status, SLA and category filters. Values live in the URL (`filters`, `onChange`) like Admin > Users. */
export function QueueFilters({ filters, onChange }) {
  const filtered = filters.status || filters.sla || filters.category;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <Filter
        id="queue-status"
        label={t("staff.filter.status")}
        allLabel={t("staff.filter.open")}
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(status) => onChange({ status })}
      />
      <Filter
        id="queue-sla"
        label={t("staff.filter.sla")}
        allLabel={t("staff.filter.any")}
        value={filters.sla}
        options={SLA_OPTIONS}
        onChange={(sla) => onChange({ sla })}
      />
      <Filter
        id="queue-category"
        label={t("staff.filter.category")}
        allLabel={t("staff.filter.any")}
        value={filters.category}
        options={CATEGORY_OPTIONS}
        onChange={(category) => onChange({ category })}
      />
      {filtered && (
        <Button variant="ghost" onClick={() => onChange({ status: "", sla: "", category: "" })}>
          {t("staff.filter.clear")}
        </Button>
      )}
    </div>
  );
}

function Filter({ id, label, allLabel, value, options, onChange }) {
  return (
    <div className="grid gap-2 sm:w-52">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map(([v, key]) => (
            <SelectItem key={v} value={v}>
              {t(key)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

import { CATEGORIES } from "@/components/report/categories";
import { FilterBar } from "@/components/system/FilterBar";
import { SLA_META, STATUS_META } from "@/components/system/statusMeta";
import { useCan } from "@/hooks/useCan";
import { t } from "@/i18n/t";
import { QUEUE_FILTER_KEYS } from "./queueFilterKeys";

/**
 * Status, SLA, category and (for people who assign work: dept_head and up) Department / Triage queue.
 * Values live in the URL; the page passes them in (`filters`) and gets `onChange(patch)` back.
 */
export function QueueFilters({ filters, onChange }) {
  const can = useCan();
  const defs = [
    {
      key: "status",
      label: t("staff.filter.status"),
      allLabel: t("staff.filter.open"),
      options: Object.entries(STATUS_META).map(([v, meta]) => [v, t(meta.labelKey)]),
    },
    {
      key: "sla",
      label: t("staff.filter.sla"),
      allLabel: t("staff.filter.any"),
      options: ["on_track", "at_risk", "breached"].map((v) => [v, t(SLA_META[v].labelKey)]),
    },
    {
      key: "category",
      label: t("staff.filter.category"),
      allLabel: t("staff.filter.any"),
      options: CATEGORIES.map((c) => [c.value, t(c.label)]),
    },
    can("issue:assign") && {
      key: "queue",
      label: t("staff.filter.queue"),
      allLabel: t("staff.filter.any"),
      options: [
        ["department", t("staff.filter.queueDepartment")],
        ["triage", t("staff.filter.queueTriage")],
      ],
    },
  ].filter(Boolean);

  return (
    <FilterBar
      filters={defs.map((d) => ({ ...d, value: filters[d.key] }))}
      onChange={(key, value) => onChange({ [key]: value })}
      onClear={() => onChange(Object.fromEntries(QUEUE_FILTER_KEYS.map((k) => [k, ""])))}
    />
  );
}

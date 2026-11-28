import {
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  actionLabel,
  targetLabel,
} from "@/components/admin/auditText";
import { FilterBar } from "@/components/system/FilterBar";
import { t } from "@/i18n/t";

/** Action and target type, the two filters the server takes (values from its validator). */
export function AuditFilters({ filters, onChange }) {
  return (
    <FilterBar
      filters={[
        {
          key: "action",
          label: t("admin.audit.filterAction"),
          allLabel: t("admin.audit.allActions"),
          options: AUDIT_ACTIONS.map((a) => [a, actionLabel(a) ?? a]),
          value: filters.action,
        },
        {
          key: "targetType",
          label: t("admin.audit.filterTarget"),
          allLabel: t("admin.audit.allTargets"),
          options: AUDIT_TARGETS.map((type) => [type, targetLabel(type)]),
          value: filters.targetType,
        },
      ]}
      onChange={(key, value) => onChange({ [key]: value })}
      onClear={() => onChange({ action: "", targetType: "" })}
    />
  );
}

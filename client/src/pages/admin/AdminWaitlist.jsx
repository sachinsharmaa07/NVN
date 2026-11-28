import { ListOrderedIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { WaitlistTable } from "@/components/admin/WaitlistTable";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWaitlist } from "@/hooks/useWaitlist";
import { t } from "@/i18n/t";

const LIMITS = ["20", "50"];

function WaitlistContent() {
  const [params, setParams] = useSearchParams();
  const limit = params.get("limit") === "50" ? 50 : 20;
  const query = useWaitlist({ limit });
  const rows = query.data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("admin.waitlist.title")} description={t("admin.waitlist.description")} />
      <div className="grid gap-2 sm:w-48">
        <Label htmlFor="waitlist-limit">{t("admin.waitlist.limit")}</Label>
        <Select
          value={String(limit)}
          onValueChange={(v) => setParams(v === "20" ? {} : { limit: v }, { replace: true })}
        >
          <SelectTrigger id="waitlist-limit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMITS.map((n) => (
              <SelectItem key={n} value={n}>
                {t("admin.waitlist.top", { count: n })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <WaitlistTable
        rows={rows}
        busy={query.isPlaceholderData}
        isLoading={query.isPending}
        isError={query.isError}
        errorTitle={t("admin.waitlist.error")}
        onRetry={() => query.refetch()}
        empty={<EmptyState icon={ListOrderedIcon} title={t("admin.waitlist.empty")} />}
      />
    </div>
  );
}

// Super admins only (city:onboard). Everyone else sees the 403 page in place.
export function AdminWaitlist() {
  return (
    <RequireAuth verified permission="city:onboard">
      <WaitlistContent />
    </RequireAuth>
  );
}

export default AdminWaitlist;

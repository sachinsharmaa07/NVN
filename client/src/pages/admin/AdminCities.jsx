import { Building2Icon, PlusIcon, SearchXIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { CitiesTable } from "@/components/admin/CitiesTable";
import { CityFormDialog } from "@/components/admin/CityFormDialog";
import { CityStatusDialog } from "@/components/admin/CityStatusDialog";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EmptyState } from "@/components/system/EmptyState";
import { FilterBar } from "@/components/system/FilterBar";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminCities, useUpdateCity } from "@/hooks/useAdminCities";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { t } from "@/i18n/t";
import { STATE_CODES } from "@/lib/stateCodes";

const TABS = ["active", "onboarding"];

function CitiesContent() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") === "onboarding" ? "onboarding" : "active";
  const stateCode = params.get("stateCode") ?? "";
  const q = params.get("q") ?? "";
  const query = useAdminCities({ status, stateCode, q });
  const cities = query.data?.pages.flatMap((p) => p.items) ?? [];
  const update = useUpdateCity();
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState(null); // the city being paused or opened
  const [error, setError] = useState("");

  const setParam = useCallback(
    (patch) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  // Search is typed here and reaches the URL (and the query) 300ms after the last key. When the URL
  // changes without typing (Clear, Back), the box follows it (state adjusted during render).
  const [text, setText] = useState(q);
  const [seenQ, setSeenQ] = useState(q);
  if (q !== seenQ) {
    setSeenQ(q);
    setText(q);
  }
  const settled = useDebouncedValue(text, 300);
  useEffect(() => {
    if (settled !== q) setParam({ q: settled.trim() });
  }, [settled, q, setParam]);

  async function confirmToggle() {
    const pausing = target.status === "active";
    setError("");
    try {
      await update.mutateAsync({ id: target.id, status: pausing ? "onboarding" : "active" });
      toast.success(t(pausing ? "admin.cities.pausedToast" : "admin.cities.openedToast"));
      setTarget(null);
    } catch (e) {
      setError(e.message);
    }
  }

  const filtered = Boolean(q || stateCode);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader
        title={t("admin.cities.title")}
        description={t("admin.cities.description")}
        actions={
          <Button onClick={() => setAdding(true)}>
            <PlusIcon aria-hidden="true" />
            {t("admin.cities.add")}
          </Button>
        }
      />
      <Tabs
        value={status}
        onValueChange={(next) => setParam({ status: next === "active" ? "" : next })}
      >
        <TabsList aria-label={t("admin.cities.tabsLabel")}>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`admin.cities.tab.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="city-search">{t("admin.cities.search")}</Label>
          <Input
            id="city-search"
            type="search"
            value={text}
            placeholder={t("admin.cities.searchPlaceholder")}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <FilterBar
          filters={[
            {
              key: "stateCode",
              label: t("admin.cities.colState"),
              allLabel: t("admin.cities.allStates"),
              options: STATE_CODES.map((code) => [code, code]),
              value: stateCode,
            },
          ]}
          onChange={(key, value) => setParam({ [key]: value })}
          onClear={() => {
            setText("");
            setParam({ stateCode: "", q: "" });
          }}
        />
      </div>
      <CitiesTable
        cities={cities}
        onToggle={(city) => {
          setError("");
          setTarget(city);
        }}
        busy={query.isPlaceholderData}
        isLoading={query.isPending}
        isError={query.isError}
        errorTitle={t("admin.cities.error")}
        onRetry={() => query.refetch()}
        empty={
          <EmptyState
            icon={filtered ? SearchXIcon : Building2Icon}
            title={t(filtered ? "admin.cities.noMatch" : `admin.cities.empty.${status}`)}
            hint={t(filtered ? "admin.cities.noMatchHint" : "admin.cities.emptyHint")}
          />
        }
        hasMore={query.hasNextPage}
        onLoadMore={() => query.fetchNextPage()}
        loadingMore={query.isFetchingNextPage}
      />
      <CityStatusDialog
        city={target}
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        onConfirm={confirmToggle}
        pending={update.isPending}
        error={error}
      />
      <CityFormDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={() => setParam({ status: "onboarding" })}
      />
    </div>
  );
}

// Super admins only (city:onboard). Everyone else sees the 403 page in place.
export function AdminCities() {
  return (
    <RequireAuth verified permission="city:onboard">
      <CitiesContent />
    </RequireAuth>
  );
}

export default AdminCities;

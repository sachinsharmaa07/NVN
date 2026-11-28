import { SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { t } from "@/i18n/t";

const ALL = "all"; // Radix Select cannot hold an empty value

/**
 * Filters for a list (02-lld §2). The URL is the source of truth: the page passes the current values in
 * and gets `onChange(key, value)` back ("" means no filter).
 * - filters: [{ key, label, allLabel, options: [[value, label]], value }]
 * From 1024px, a row of labelled selects and "Clear filters" (only when one is set). Below, a "Filters"
 * button with the number set, opening a Drawer with the same selects and "Apply filters".
 */
export function FilterBar({ filters, onChange, onClear }) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const active = filters.filter((f) => f.value).length;

  if (desktop) {
    return (
      <div className="flex flex-wrap items-end gap-4">
        {filters.map((f) => (
          <FilterSelect
            key={f.key}
            filter={f}
            value={f.value}
            onChange={(v) => onChange(f.key, v)}
          />
        ))}
        {active > 0 && (
          <Button variant="ghost" onClick={onClear}>
            {t("system.filters.clear")}
          </Button>
        )}
      </div>
    );
  }
  return <FilterDrawer filters={filters} active={active} onChange={onChange} onClear={onClear} />;
}

// Phones: choices are held here until "Apply filters", so the list doesn't refetch on every pick.
function FilterDrawer({ filters, active, onChange, onClear }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const current = (f) => (f.key in draft ? draft[f.key] : f.value);

  function apply() {
    for (const f of filters) if (current(f) !== f.value) onChange(f.key, current(f));
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        onClick={() => {
          setDraft({});
          setOpen(true);
        }}
      >
        <SlidersHorizontalIcon aria-hidden="true" />
        {active > 0
          ? t("system.filters.buttonCount", { count: active })
          : t("system.filters.button")}
      </Button>
      {active > 0 && (
        <Button variant="ghost" onClick={onClear}>
          {t("system.filters.clear")}
        </Button>
      )}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t("system.filters.title")}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {t("system.filters.description")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4">
            {filters.map((f) => (
              <FilterSelect
                key={f.key}
                filter={f}
                value={current(f)}
                onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
              />
            ))}
          </div>
          <DrawerFooter>
            <Button onClick={apply}>{t("system.filters.apply")}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function FilterSelect({ filter, value, onChange }) {
  const id = `filter-${filter.key}`;
  return (
    <div className="grid gap-2 lg:w-52">
      <Label htmlFor={id}>{filter.label}</Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{filter.allLabel}</SelectItem>
          {filter.options.map(([v, label]) => (
            <SelectItem key={v} value={v}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

import { useEffect, useState } from "react";
import { FilterBar } from "@/components/system/FilterBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n/t";
import { ROLES, roleName } from "@/lib/roles";

/*
 * A full-width search box above Role and Status (the shared FilterBar: selects from 1024px, a
 * "Filters" drawer below). The values live in the URL (`filters`, `onChange`), so a refresh or a shared
 * link keeps them. The search text is typed locally and sent 300 ms after the last keystroke, so we
 * don't call the API on every letter.
 */
export function UserFilters({ filters, onChange }) {
  const [text, setText] = useState(filters.q);
  // The URL can change without typing (Clear filters, browser Back): when it does, the box follows.
  // (Adjusting state while rendering is React's way to derive state from a changed prop.)
  const [seenQ, setSeenQ] = useState(filters.q);
  if (filters.q !== seenQ) {
    setSeenQ(filters.q);
    setText(filters.q);
  }

  // Debounce: wait 300ms of quiet, then push the text to the URL (and so to the query).
  useEffect(() => {
    if (text === filters.q) return undefined;
    const timer = setTimeout(() => onChange({ q: text }), 300);
    return () => clearTimeout(timer);
  }, [text, filters.q, onChange]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="user-search">{t("admin.users.search")}</Label>
        <Input
          id="user-search"
          type="search"
          value={text}
          placeholder={t("admin.users.searchPlaceholder")}
          aria-describedby="user-search-hint"
          onChange={(e) => setText(e.target.value)}
        />
        <p id="user-search-hint" className="text-sm text-muted-foreground">
          {t("admin.users.searchHint")}
        </p>
      </div>
      <FilterBar
        filters={[
          {
            key: "role",
            label: t("admin.users.filterRole"),
            allLabel: t("admin.users.all"),
            options: ROLES.map((role) => [role, roleName(role)]),
            value: filters.role,
          },
          {
            key: "status",
            label: t("admin.users.filterStatus"),
            allLabel: t("admin.users.all"),
            options: [
              ["active", t("admin.users.active")],
              ["suspended", t("admin.users.suspended")],
            ],
            value: filters.status,
          },
        ]}
        onChange={(key, value) => onChange({ [key]: value })}
        onClear={() => {
          setText("");
          onChange({ q: "", role: "", status: "" });
        }}
      />
    </div>
  );
}

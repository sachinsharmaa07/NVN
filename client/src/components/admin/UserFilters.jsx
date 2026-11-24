import { useEffect, useState } from "react";
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
import { t } from "@/i18n/t";
import { ROLES, roleName } from "@/lib/roles";

const ALL = "all"; // Radix Select cannot hold an empty value, so "no filter" is this word

/*
 * Search box + Role and Status filters. The values live in the URL (`filters`, `onChange`), so a
 * refresh or a shared link keeps them. The search text is typed locally and sent 300 ms after the
 * last keystroke, so we don't call the API on every letter.
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

  const hasFilters = filters.q || filters.role || filters.status;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="grid flex-1 gap-2 sm:min-w-64">
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
      <div className="grid gap-2 sm:w-48">
        <Label htmlFor="user-role">{t("admin.users.filterRole")}</Label>
        <Select
          value={filters.role || ALL}
          onValueChange={(v) => onChange({ role: v === ALL ? "" : v })}
        >
          <SelectTrigger id="user-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("admin.users.all")}</SelectItem>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {roleName(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 sm:w-48">
        <Label htmlFor="user-status">{t("admin.users.filterStatus")}</Label>
        <Select
          value={filters.status || ALL}
          onValueChange={(v) => onChange({ status: v === ALL ? "" : v })}
        >
          <SelectTrigger id="user-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("admin.users.all")}</SelectItem>
            <SelectItem value="active">{t("admin.users.active")}</SelectItem>
            <SelectItem value="suspended">{t("admin.users.suspended")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          onClick={() => {
            setText("");
            onChange({ q: "", role: "", status: "" });
          }}
        >
          {t("admin.users.clear")}
        </Button>
      )}
    </div>
  );
}

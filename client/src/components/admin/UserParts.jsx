import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { StateBadge } from "@/components/system/StateBadge";
import { AccountAvatar } from "@/components/auth/AccountAvatar";
import { t } from "@/i18n/t";
import { displayName } from "@/components/admin/userText";

// Small pieces shared by the desktop table and the phone cards, so both say the same things.

// Avatar, name and email under it. Long emails wrap instead of widening the layout.
export function UserIdentity({ user }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <AccountAvatar user={user} className="size-10 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-foreground">{displayName(user)}</span>
        <span className="truncate text-sm text-muted-foreground">{user.email}</span>
      </span>
    </span>
  );
}

// Status is icon + text, never colour alone (UI.md §7).
export function StatusText({ user }) {
  if (user.status === "suspended") {
    return (
      <StateBadge tone="bad" icon={CircleXIcon}>
        {t("admin.users.suspended")}
      </StateBadge>
    );
  }
  return (
    <StateBadge tone="good" icon={CircleCheckIcon}>
      {t("admin.users.active")}
    </StateBadge>
  );
}

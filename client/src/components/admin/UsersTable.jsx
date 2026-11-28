import { RoleBadge } from "@/components/auth/RoleBadge";
import { UserCard } from "@/components/admin/UserCard";
import { StatusText, UserIdentity } from "@/components/admin/UserParts";
import { areaText } from "@/components/admin/userText";
import { UserActionsMenu } from "@/components/admin/UserActionsMenu";
import { LedgerTable } from "@/components/system/LedgerTable";
import { t } from "@/i18n/t";
import { formatDate } from "@/lib/format";

/**
 * People in the admin's scope as a ledger: a real table from 1024px (caption read by screen readers
 * only; the name cell is the row header, so each row is announced by its person), one card per person
 * below. Loading, error, empty and "Load more" come from LedgerTable (`ledger` props).
 */
export function UsersTable({ users, actorId, onAction, ...ledger }) {
  const columns = [
    {
      key: "name",
      header: t("admin.users.colName"),
      className: "max-w-72 text-foreground",
      cell: (user) => <UserIdentity user={user} />,
    },
    {
      key: "role",
      header: t("admin.users.colRole"),
      cell: (user) => <RoleBadge role={user.role} />,
    },
    { key: "area", header: t("admin.users.colArea"), cell: areaText },
    {
      key: "status",
      header: t("admin.users.colStatus"),
      cell: (user) => <StatusText user={user} />,
    },
    {
      key: "lastSeen",
      header: t("admin.users.colLastSeen"),
      className: "whitespace-nowrap",
      cell: (user) => formatDate(user.lastLoginAt) || t("admin.users.never"),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("admin.users.colActions")}</span>,
      className: "w-16",
      cell: (user) => <UserActionsMenu user={user} actorId={actorId} onAction={onAction} />,
    },
  ];

  return (
    <LedgerTable
      columns={columns}
      rows={users}
      getRowKey={(user) => user.id}
      caption={t("admin.users.caption")}
      renderCard={(user) => <UserCard user={user} actorId={actorId} onAction={onAction} />}
      {...ledger}
    />
  );
}

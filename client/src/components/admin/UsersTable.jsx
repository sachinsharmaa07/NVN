import { RoleBadge } from "@/components/auth/RoleBadge";
import { StatusText, UserIdentity } from "@/components/admin/UserParts";
import { areaText } from "@/components/admin/userText";
import { UserActionsMenu } from "@/components/admin/UserActionsMenu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/i18n/t";
import { formatDate } from "@/lib/format";

// The desktop list (1024px and up): a real table. The caption is read by
// screen readers only. The name cell is a row header so each row is announced by its person.
export function UsersTable({ users, actorId, onAction }) {
  return (
    <Table>
      <TableCaption className="sr-only">{t("admin.users.caption")}</TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t("admin.users.colName")}</TableHead>
          <TableHead>{t("admin.users.colRole")}</TableHead>
          <TableHead>{t("admin.users.colArea")}</TableHead>
          <TableHead>{t("admin.users.colStatus")}</TableHead>
          <TableHead>{t("admin.users.colLastSeen")}</TableHead>
          <TableHead className="w-16">
            <span className="sr-only">{t("admin.users.colActions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableHead scope="row" className="max-w-72 py-3 font-normal text-foreground">
              <UserIdentity user={user} />
            </TableHead>
            <TableCell>
              <RoleBadge role={user.role} />
            </TableCell>
            <TableCell>{areaText(user)}</TableCell>
            <TableCell>
              <StatusText user={user} />
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(user.lastLoginAt) || t("admin.users.never")}
            </TableCell>
            <TableCell>
              <UserActionsMenu user={user} actorId={actorId} onAction={onAction} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

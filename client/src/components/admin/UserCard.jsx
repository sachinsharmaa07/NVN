import { RoleBadge } from "@/components/auth/RoleBadge";
import { StatusText, UserIdentity } from "@/components/admin/UserParts";
import { areaText } from "@/components/admin/userText";
import { UserActionsMenu } from "@/components/admin/UserActionsMenu";
import { Card } from "@/components/ui/card";
import { t } from "@/i18n/t";
import { formatDate } from "@/lib/format";

// The phone layout (below 1024px): one card per user, same facts and same action names as the table.
export function UserCard({ user, actorId, onAction }) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <UserIdentity user={user} />
        <UserActionsMenu user={user} actorId={actorId} onAction={onAction} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("admin.users.colRole")}</dt>
        <dd>
          <RoleBadge role={user.role} />
        </dd>
        <dt className="text-muted-foreground">{t("admin.users.colArea")}</dt>
        <dd>{areaText(user)}</dd>
        <dt className="text-muted-foreground">{t("admin.users.colStatus")}</dt>
        <dd>
          <StatusText user={user} />
        </dd>
        <dt className="text-muted-foreground">{t("admin.users.colLastSeen")}</dt>
        <dd>{formatDate(user.lastLoginAt) || t("admin.users.never")}</dd>
      </dl>
    </Card>
  );
}

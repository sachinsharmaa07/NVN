import { EllipsisVerticalIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCan } from "@/hooks/useCan";
import { t } from "@/i18n/t";

/*
 * The 44px "Actions for {name}" button on each row. Renders nothing when the server says the
 * actor can't manage this user (`canManage: false`) or the row is the actor's own.
 * onAction(kind, user, button) lets the page open the right dialog and remember which button to
 * give focus back to when the dialog closes.
 */
export function UserActionsMenu({ user, actorId, onAction }) {
  const can = useCan();
  const triggerRef = useRef(null);
  if (!user.canManage || user.id === actorId) return null;
  const name = user.name || user.email;
  const suspended = user.status === "suspended";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          aria-label={t("admin.users.actionsFor", { name })}
        >
          <EllipsisVerticalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {can("user:promote") && (
          <DropdownMenuItem onSelect={() => onAction("role", user, triggerRef.current)}>
            {t("admin.users.changeRole")}
          </DropdownMenuItem>
        )}
        {can("user:suspend") && (
          <DropdownMenuItem
            onSelect={() =>
              onAction(suspended ? "reactivate" : "suspend", user, triggerRef.current)
            }
          >
            {suspended ? t("admin.users.reactivate") : t("admin.users.suspend")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

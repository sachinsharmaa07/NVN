import { BellIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { STATUS_META } from "@/components/system/statusMeta";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useMarkAllRead, useNotifications } from "@/hooks/useNotifications";
import { t } from "@/i18n/t";
import { formatDateTime } from "@/lib/format";

// The server sends no free text: each line is built from type, ticketId and status (docs/API.md).
const textOf = (n) =>
  t(`notifications.type.${n.type.replace(/_(\w)/g, (_, c) => c.toUpperCase())}`, {
    ticket: n.ticketId,
    status: STATUS_META[n.status] ? t(STATUS_META[n.status].labelKey) : "",
  });
// SLA alerts go to staff, who work from the queue; the rest are about a resident's own ticket.
const linkOf = (n) => (n.type.startsWith("sla_") ? "/staff" : `/issues/${n.ticketId}`);

/** Bell in the top bar for signed-in people: unread count, a menu of the latest, Mark all read. */
export function NotificationBell() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const query = useNotifications({ enabled: status === "signedIn" });
  const markAll = useMarkAllRead();
  if (status !== "signedIn") return null;

  const items = query.data?.items ?? [];
  const unread = query.data?.unread ?? 0;
  const label = unread
    ? t("notifications.labelUnread", { count: unread })
    : t("notifications.label");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative size-11">
          <BellIcon aria-hidden="true" className="size-5" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              data-testid="unread-count"
              className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-sm bg-primary px-1 text-xs font-semibold text-primary-foreground tabular-nums"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>{t("notifications.title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">{t("notifications.empty")}</p>
        )}
        {items.map((n) => (
          <DropdownMenuItem
            key={n.id}
            onSelect={() => navigate(linkOf(n))}
            className="flex min-h-11 flex-col items-start gap-1"
          >
            <span className={n.read ? "text-muted-foreground" : "font-medium"}>
              {!n.read && <span className="sr-only">{t("notifications.new")}</span>}
              {textOf(n)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDateTime(n.createdAt)}
            </span>
          </DropdownMenuItem>
        ))}
        {unread > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11" onSelect={() => markAll.mutate()}>
              {t("notifications.markAll")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
      {/* Announces new unread ones; empty otherwise, so it never talks over the page's own messages. */}
      <span role="status" className="sr-only">
        {unread > 0 ? label : ""}
      </span>
    </DropdownMenu>
  );
}

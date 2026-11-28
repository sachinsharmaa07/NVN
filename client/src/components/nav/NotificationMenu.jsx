import { useNavigate } from "react-router";
import { STATUS_META } from "@/components/system/statusMeta";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/** The notifications menu, loaded lazily by NotificationBell (components/system/LazyMenu.jsx). */
export default function NotificationMenu({ trigger, defaultOpen }) {
  const navigate = useNavigate();
  // Same query (and cache entry) as the bell's, so the list is already here when the menu opens.
  const query = useNotifications({ enabled: true });
  const markAll = useMarkAllRead();
  const items = query.data?.items ?? [];
  const unread = query.data?.unread ?? 0;

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
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
    </DropdownMenu>
  );
}

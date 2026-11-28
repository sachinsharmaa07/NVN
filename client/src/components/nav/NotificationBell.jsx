import { BellIcon } from "lucide-react";
import { LazyMenu } from "@/components/system/LazyMenu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { t } from "@/i18n/t";

// The menu's code loads lazily (LazyMenu); the bell and its count are here from the first paint.
const loadMenu = () => import("./NotificationMenu");

/** Bell in the top bar for signed-in people: unread count, a menu of the latest, Mark all read. */
export function NotificationBell() {
  const { status } = useAuth();
  const query = useNotifications({ enabled: status === "signedIn" });
  if (status !== "signedIn") return null;

  const unread = query.data?.unread ?? 0;
  const label = unread
    ? t("notifications.labelUnread", { count: unread })
    : t("notifications.label");

  return (
    <>
      <LazyMenu
        load={loadMenu}
        trigger={
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
        }
      />
      {/* Announces new unread ones; empty otherwise, so it never talks over the page's own messages. */}
      <span role="status" className="sr-only">
        {unread > 0 ? label : ""}
      </span>
    </>
  );
}

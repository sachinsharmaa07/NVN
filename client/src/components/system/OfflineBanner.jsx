import { WifiOffIcon } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { t } from "@/i18n/t";

/*
 * A quiet bar under the top bar while the phone has no network (UI.md §5.2). The status region is
 * always in the page and only its text changes, so screen readers announce going offline once.
 */
export function OfflineBanner() {
  const online = useOnline();
  return (
    <div role="status">
      {!online && (
        <p className="fade-in flex min-h-10 items-center gap-2 bg-muted px-4 text-sm text-muted-foreground">
          <WifiOffIcon aria-hidden="true" className="size-4 shrink-0" />
          {t("shell.offline")}
        </p>
      )}
    </div>
  );
}

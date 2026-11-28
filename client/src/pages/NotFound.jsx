import { SearchXIcon } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/system/EmptyState";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { useClaimPagePrimary } from "@/hooks/usePagePrimary";

// Any address the router doesn't know: one designed state, its title the page's h1, and the way home.
export function NotFound() {
  // Go to home: its own primary button, so the sidebar's Report turns outline (one primary per screen).
  useClaimPagePrimary();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 *:max-w-160 md:px-6 md:py-12 lg:px-8">
      <EmptyState
        icon={SearchXIcon}
        titleAs="h1"
        title={t("shell.notFound.emptyTitle")}
        hint={t("shell.notFound.emptyHint")}
        action={
          <Button asChild>
            <Link to="/">{t("shell.common.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}

export default NotFound;

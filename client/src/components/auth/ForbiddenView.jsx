import { ShieldAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";
import { EmptyState } from "@/components/system/EmptyState";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";

// The "you can't see this" block. Shown in place by RequireAuth and as the /forbidden page.
// Focus moves to <main> on arrival so keyboard and screen-reader users land on the message.
export function ForbiddenView() {
  useEffect(() => {
    document.getElementById("main")?.focus();
  }, []);
  return (
    <div className="mx-auto flex w-full max-w-160 flex-col px-4 py-12 md:px-6 lg:px-8">
      <EmptyState
        icon={ShieldAlertIcon}
        titleAs="h1"
        title={t("auth.forbidden.title")}
        hint={t("auth.forbidden.hint")}
        action={
          <Button asChild>
            <Link to="/">{t("shell.common.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}

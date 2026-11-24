import { ClipboardListIcon } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";

// "My issues" placeholder. Shows the empty state from docs/UI.md §7 until sign-in and the
// issues list exist: what this page is, why it's empty, and the one thing to do next.
export function Issues() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("shell.issues.title")} description={t("shell.issues.description")} />
      <EmptyState
        icon={ClipboardListIcon}
        title={t("shell.issues.emptyTitle")}
        hint={t("shell.issues.emptyHint")}
        action={
          <Button asChild>
            <Link to="/report">{t("shell.nav.reportLong")}</Link>
          </Button>
        }
      />
    </div>
  );
}

export default Issues;

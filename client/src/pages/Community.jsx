import { UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { t } from "@/i18n/t";

// Community feed placeholder. No button yet: posting isn't built, and a button that leads
// nowhere would be worse than none.
export function Community() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader
        title={t("shell.community.title")}
        description={t("shell.community.description")}
      />
      <EmptyState
        icon={UsersIcon}
        title={t("shell.community.emptyTitle")}
        hint={t("shell.community.emptyHint")}
      />
    </div>
  );
}

export default Community;

import { ShieldCheckIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ModerationItem } from "@/components/community/ModerationItem";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useModerate, useModerationQueue } from "@/hooks/useCommunity";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

const TYPES = ["post", "comment"];

function Queue() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") === "comment" ? "comment" : "post";
  const query = useModerationQueue(type);
  const moderate = useModerate(type);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  let body;
  if (query.isPending) {
    body = <Skeleton aria-hidden="true" className="h-48 w-full" />;
  } else if (query.isError) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{t("moderation.error")}</p>
        <Button variant="secondary" onClick={() => query.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={ShieldCheckIcon}
        title={t("moderation.emptyTitle")}
        hint={t("moderation.emptyHint")}
      />
    );
  } else {
    body = (
      <ul className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <ModerationItem
              type={type}
              item={item}
              busy={moderate.isPending && moderate.variables?.id === item.id}
              onAct={(vars) => moderate.mutate(vars)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("moderation.title")} description={t("moderation.description")} />
      {/* Two views of one queue; a toggle group (aria-pressed), so the type stays in the URL for Back. */}
      <div role="group" aria-label={t("moderation.tabsLabel")} className="flex gap-2">
        {TYPES.map((value) => (
          <Button
            key={value}
            variant="outline"
            aria-pressed={type === value}
            className={cn(type === value && "border-primary bg-accent text-accent-foreground")}
            onClick={() => setParams(value === "post" ? {} : { type: value })}
          >
            {t(`moderation.tab.${value}`)}
          </Button>
        ))}
      </div>
      {body}
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => query.fetchNextPage()}
            loading={query.isFetchingNextPage}
          >
            {t("moderation.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function Moderation() {
  return (
    <RequireAuth permission="post:moderate">
      <Queue />
    </RequireAuth>
  );
}

export default Moderation;

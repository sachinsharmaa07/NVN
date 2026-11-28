import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ShieldCheckIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ModerationItem } from "@/components/community/ModerationItem";
import { EmptyState } from "@/components/system/EmptyState";
import { ErrorState } from "@/components/system/ErrorState";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/system/SkeletonList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModerate, useModerationQueue } from "@/hooks/useCommunity";
import { t } from "@/i18n/t";
import { durations, easings } from "@/lib/motion";

const TYPES = ["post", "comment"];
// A restored or deleted item leaves: it fades out in `fast`, and the list closes the gap in `base`.
// (Under reduced motion, MotionConfig reducedMotion="user" in Providers stills the layout move.)
const LEAVE = { opacity: 0, transition: { duration: durations.fast, ease: easings.exit } };
const CLOSE_GAP = { layout: { duration: durations.base, ease: easings.standard } };

function List({ type }) {
  const query = useModerationQueue(type);
  const moderate = useModerate(type);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isPending) {
    // Shaped like the review cards: same two-column grid from 1024px.
    return (
      <SkeletonList
        count={2}
        itemClassName="h-56 rounded-lg"
        className="grid gap-3 lg:grid-cols-2"
      />
    );
  }
  if (query.isError) {
    return (
      <ErrorState variant="inline" title={t("moderation.error")} onRetry={() => query.refetch()} />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheckIcon}
        title={t("moderation.emptyTitle")}
        hint={t("moderation.emptyHint")}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-3 lg:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => (
            <m.li key={item.id} layout transition={CLOSE_GAP} exit={LEAVE}>
              <ModerationItem
                type={type}
                item={item}
                busy={moderate.isPending && moderate.variables?.id === item.id}
                onAct={(vars) => moderate.mutate(vars)}
              />
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
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

/**
 * The moderation queue: hidden posts and comments to restore or delete. Two tabs (Posts / Comments) that
 * drive ?type=, so Back and a shared link keep the view; arrow keys move between tabs, Tab enters the
 * panel, and the indicator slides (static under reduced motion).
 */
function Queue() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") === "comment" ? "comment" : "post";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("moderation.title")} description={t("moderation.description")} />
      <Tabs
        value={type}
        onValueChange={(value) => setParams(value === "post" ? {} : { type: value })}
        className="gap-6"
      >
        <TabsList aria-label={t("moderation.tabsLabel")}>
          {TYPES.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`moderation.tab.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {TYPES.map((value) => (
          <TabsContent key={value} value={value}>
            {value === type && <List type={value} />}
          </TabsContent>
        ))}
      </Tabs>
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

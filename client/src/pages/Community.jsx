import { PenLineIcon, UsersIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PincodeStamp } from "@/components/community/PincodeStamp";
import { PincodeSwitch } from "@/components/community/PincodeSwitch";
import { PostCard } from "@/components/community/PostCard";
import { PostComposer } from "@/components/community/PostComposer";
import { EmptyState } from "@/components/system/EmptyState";
import { ErrorState } from "@/components/system/ErrorState";
import { durations, easings } from "@/components/system/motionTokens";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/system/SkeletonList";
import { useFeed } from "@/hooks/useCommunity";
import { useMe } from "@/hooks/useMe";
import { t } from "@/i18n/t";

// Cards arrive one after another, 30ms apart, at most 8 staggered (UI.md §4); new pages arrive together.
const list = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } };
const item = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.base, ease: easings.enter } },
};

/** One pincode's notices: the board itself, with Load more. ("Write a post" lives in the header.) */
function Feed({ pincode }) {
  const query = useFeed(pincode);
  const reduce = useReducedMotion();
  const [announcement, setAnnouncement] = useState("");
  const posts = query.data?.pages.flatMap((p) => p.items) ?? [];

  async function loadMore() {
    const result = await query.fetchNextPage();
    const after = result.data?.pages.flatMap((p) => p.items).length ?? posts.length;
    setAnnouncement(t("community.feed.loaded", { count: after - posts.length }));
  }

  if (query.isPending) {
    // Shaped like the post cards: same two-column grid from 768px.
    return (
      <SkeletonList
        count={4}
        itemClassName="h-40 rounded-lg"
        className="grid gap-3 md:grid-cols-2"
      />
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        variant="inline"
        title={t("community.feed.error")}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title={t("community.feed.emptyTitle", { pincode })}
        hint={t("community.feed.emptyHint")}
      />
    );
  }
  return (
    <section aria-labelledby="feed-title" className="flex flex-col gap-4">
      {/* The post titles are h3s; this keeps the outline whole without a second visible heading. */}
      <h2 id="feed-title" className="sr-only">
        {t("community.feed.listTitle", { pincode })}
      </h2>
      <m.ul
        variants={list}
        initial={reduce ? false : "hidden"}
        animate="visible"
        className="grid gap-3 md:grid-cols-2"
      >
        {posts.map((post, i) => (
          <m.li key={post.id} variants={i < 8 ? item : undefined}>
            <PostCard post={post} />
          </m.li>
        ))}
      </m.ul>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} loading={query.isFetchingNextPage}>
            {t("community.feed.loadMore")}
          </Button>
        </div>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

/** No home pincode yet: one left-aligned group, the way to add one, then the labelled switch. */
function NoHomePincode({ onShow }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <EmptyState
        variant="inline"
        title={t("community.feed.noPincodeTitle")}
        hint={t("community.feed.noPincodeHint")}
        action={
          <Button asChild variant="outline">
            <Link to="/profile">{t("community.feed.addPincode")}</Link>
          </Button>
        }
      />
      <PincodeSwitch onShow={onShow} />
    </div>
  );
}

function CommunityPage() {
  const { user } = useMe();
  const [params, setParams] = useSearchParams();
  const [composing, setComposing] = useState(false);
  const home = user?.defaultPincode ?? null;
  const pincode = params.get("pincode") ?? home;
  const show = (pin) => setParams(pin === home ? {} : { pincode: pin });
  const canPost = Boolean(home) && pincode === home;

  const writeButton = canPost && (
    <Button onClick={() => setComposing(true)}>
      <PenLineIcon aria-hidden="true" />
      {t("community.composer.open")}
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader
        title={t("community.page.title")}
        description={t("community.feed.intro")}
        meta={pincode && <PincodeStamp pincode={pincode} />}
        actions={
          pincode && (
            <div className="flex flex-col items-start gap-3 lg:items-end">
              {writeButton}
              <PincodeSwitch onShow={show} />
              {home && pincode !== home && (
                <Button variant="link" className="px-0" onClick={() => show(home)}>
                  {t("community.switch.backHome")}
                </Button>
              )}
            </div>
          )
        }
      />
      {pincode ? <Feed key={pincode} pincode={pincode} /> : <NoHomePincode onShow={show} />}
      {canPost && <PostComposer pincode={pincode} open={composing} onOpenChange={setComposing} />}
    </div>
  );
}

export function Community() {
  return (
    <RequireAuth>
      <CommunityPage />
    </RequireAuth>
  );
}

export default Community;

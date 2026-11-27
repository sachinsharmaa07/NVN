import { ArrowLeftIcon, EyeOffIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { CommentForm } from "@/components/community/CommentForm";
import { CommentThread } from "@/components/community/CommentThread";
import { ContentMenu } from "@/components/community/ContentMenu";
import { bylineOf, commentCountLabel } from "@/components/community/communityText";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddComment, useComments, usePost } from "@/hooks/useCommunity";
import { useMe } from "@/hooks/useMe";
import { t } from "@/i18n/t";

function Comments({ post }) {
  const { user } = useMe();
  const query = useComments(post.id);
  const add = useAddComment(post.id, user?.name ?? "");
  const comments = query.data?.pages.flatMap((p) => p.items) ?? [];
  const open = post.status === "published";

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-6">
      <h2 id="comments-heading" className="font-display text-2xl font-semibold">
        {t("community.comments.heading")}
      </h2>
      {query.isPending && <Skeleton aria-hidden="true" className="h-24 w-full" />}
      {query.isError && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{t("community.comments.error")}</p>
          <Button variant="secondary" onClick={() => query.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      )}
      {query.isSuccess && (
        <CommentThread comments={comments} postId={post.id} onReply={(body) => add.mutate(body)} />
      )}
      {query.hasNextPage && (
        <Button variant="outline" className="self-start" onClick={() => query.fetchNextPage()}>
          {t("community.feed.loadMore")}
        </Button>
      )}
      {open && (
        <CommentForm
          label={t("community.comments.label")}
          submitLabel={t("community.comments.submit")}
          onSubmit={(body) => add.mutate({ body })}
        />
      )}
    </section>
  );
}

function PostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = usePost(id);
  const post = query.data;

  if (query.isPending) {
    return <Skeleton aria-hidden="true" className="h-64 w-full" />;
  }
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{t(query.error?.status === 404 ? "community.post.notFound" : "community.feed.error")}</p>
        <Button asChild variant="secondary">
          <Link to="/community">{t("shell.community.title")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button asChild variant="link" className="self-start px-0">
        <Link to={`/community?pincode=${post.pincode}`}>
          <ArrowLeftIcon aria-hidden="true" />
          {t("community.post.back", { pincode: post.pincode })}
        </Link>
      </Button>
      <article className="flex flex-col gap-4 border-b pb-8">
        {post.status === "hidden" && (
          <p className="flex items-start gap-2 rounded-md border bg-muted p-3 text-sm">
            <EyeOffIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t("community.post.hidden")}
          </p>
        )}
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
            {post.title}
          </h1>
          <ContentMenu
            kind="post"
            item={post}
            pincode={post.pincode}
            onDeleted={() => navigate(`/community?pincode=${post.pincode}`, { replace: true })}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {bylineOf(post)}, {commentCountLabel(post.commentCount)}
        </p>
        <p className="max-w-prose whitespace-pre-line text-lg leading-relaxed">{post.body}</p>
      </article>
      <Comments post={post} />
    </>
  );
}

export function CommunityPost() {
  return (
    <RequireAuth>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12">
        <PostPage />
      </div>
    </RequireAuth>
  );
}

export default CommunityPost;

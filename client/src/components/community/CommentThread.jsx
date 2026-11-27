import { ReplyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { CommentForm } from "./CommentForm";
import { ContentMenu } from "./ContentMenu";
import { bylineOf, threadOf } from "./communityText";

function CommentBody({ comment, postId, children }) {
  return (
    <article className="flex flex-col gap-1" aria-busy={comment.pending || undefined}>
      <div className="flex items-start justify-between gap-2">
        <p className="pt-2 text-sm text-muted-foreground">
          {comment.pending ? t("community.comments.sending") : bylineOf(comment)}
        </p>
        {!comment.pending && <ContentMenu kind="comment" item={comment} postId={postId} />}
      </div>
      <p className="whitespace-pre-line text-foreground">{comment.body}</p>
      {children}
    </article>
  );
}

/** Two levels (decision M3-1): replies sit one step in, under a rule, never deeper. */
export function CommentThread({ comments, postId, onReply }) {
  const [replyTo, setReplyTo] = useState(null);
  const thread = threadOf(comments);

  if (thread.length === 0) {
    return <p className="text-muted-foreground">{t("community.comments.empty")}</p>;
  }

  return (
    <ol className="flex flex-col gap-6">
      {thread.map((comment) => (
        <li key={comment.id}>
          <CommentBody comment={comment} postId={postId}>
            {!comment.pending && replyTo !== comment.id && (
              <div>
                <Button variant="ghost" size="sm" onClick={() => setReplyTo(comment.id)}>
                  <ReplyIcon aria-hidden="true" />
                  {t("community.comments.reply")}
                </Button>
              </div>
            )}
          </CommentBody>
          {(comment.replies.length > 0 || replyTo === comment.id) && (
            <div className="mt-3 ml-3 flex flex-col gap-4 border-l-2 pl-4 sm:ml-4">
              {comment.replies.length > 0 && (
                <ol className="flex flex-col gap-4">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentBody comment={reply} postId={postId} />
                    </li>
                  ))}
                </ol>
              )}
              {replyTo === comment.id && (
                <CommentForm
                  focusOnMount
                  label={t("community.comments.replyLabel", {
                    author: comment.author || t("community.post.anonymous"),
                  })}
                  submitLabel={t("community.comments.replySubmit")}
                  onCancel={() => setReplyTo(null)}
                  onSubmit={(body) => {
                    onReply({ body, parentId: comment.id });
                    setReplyTo(null);
                  }}
                />
              )}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

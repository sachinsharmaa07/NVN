import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n/t";

/** A comment or a reply. Optimistic (the hook adds it at once), so the box clears on submit. */
export function CommentForm({ label, submitLabel, onSubmit, onCancel, focusOnMount = false }) {
  const id = useId();
  const boxRef = useRef(null);
  // The person just pressed Reply, so the reply box takes focus once.
  useEffect(() => {
    if (focusOnMount) boxRef.current?.focus();
  }, [focusOnMount]);
  const [body, setBody] = useState("");
  const trimmed = body.trim();

  function submit(event) {
    event.preventDefault();
    if (!trimmed) return;
    onSubmit(trimmed);
    setBody("");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={3}
        maxLength={1000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        ref={boxRef}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("community.comments.cancelReply")}
          </Button>
        )}
        <Button type="submit" variant="secondary" disabled={!trimmed}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

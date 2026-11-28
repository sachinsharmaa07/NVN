import { useState } from "react";
import { FieldError } from "@/components/system/FieldError";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useResolveAnswer } from "@/hooks/useIssues";
import { t } from "@/i18n/t";
import { REOPEN_MIN } from "./issueRules";
import { useClaimPagePrimary } from "@/hooks/usePagePrimary";

/**
 * Where the ticket page shows "Is it fixed?": while the ticket is resolved, and, once it has been
 * answered (closed or reopened), for one more moment while it folds away: height to 0 through CSS
 * interpolate-size plus a fade, `base` (UI.md §4). `inert` keeps the folding card out of reach.
 */
export function ResolveCard({ issue }) {
  const resolved = issue.status === "resolved";
  const [shown, setShown] = useState(resolved);
  // A ticket that becomes resolved again (a refetch) brings the card back; set during render, not in
  // an effect, so it shows in the same paint.
  if (resolved && !shown) setShown(true);
  if (!shown && !resolved) return null;
  return (
    <div
      inert={!resolved}
      // Opacity, not height: browsers without interpolate-size jump the height and fire no event for it.
      onTransitionEnd={(e) => !resolved && e.propertyName === "opacity" && setShown(false)}
      className={
        resolved
          ? "h-auto overflow-hidden opacity-100 transition-[height,opacity] duration-base ease-standard"
          : "h-0 overflow-hidden opacity-0 transition-[height,opacity] duration-base ease-standard"
      }
    >
      <ResolvePrompt issue={issue} />
    </div>
  );
}

/**
 * "Is it fixed?" under a resolved ticket, for its reporter: Confirm closes it, Reopen needs a reason of 10+
 * characters. Not optimistic: the ticket changes when the server answers (a 409 is handled in the hook).
 */
export function ResolvePrompt({ issue }) {
  const mutation = useResolveAnswer(issue.ticketId);
  // Yes, it's fixed: its own primary button, so the sidebar's Report turns outline (one primary per screen).
  useClaimPagePrimary();
  const [reopening, setReopening] = useState(false);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const short = note.trim().length < REOPEN_MIN;

  async function send(action) {
    setError("");
    if (action === "reopen" && short) return setTried(true);
    try {
      await mutation.mutateAsync({ action, version: issue.version, note: note.trim() });
    } catch (e) {
      if (e.status !== 409) setError(e.message);
    }
  }

  return (
    <section
      aria-labelledby="resolve-title"
      className="flex flex-col gap-4 rounded-lg border border-l-4 border-l-primary bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="resolve-title" className="font-display text-lg font-semibold">
          {t("issues.resolve.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("issues.resolve.hint")}</p>
      </div>
      {reopening && (
        <div className="grid gap-2">
          <Label htmlFor="reopen-note">{t("issues.resolve.reason")}</Label>
          <Textarea
            id="reopen-note"
            value={note}
            maxLength={500}
            aria-invalid={tried && short}
            aria-describedby={tried && short ? "reopen-note-error" : undefined}
            onChange={(e) => setNote(e.target.value)}
          />
          {tried && short && (
            <FieldError id="reopen-note-error">
              {t("issues.resolve.reasonShort", { min: REOPEN_MIN })}
            </FieldError>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {!reopening && (
          <Button
            onClick={() => send("confirm")}
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            {t("issues.resolve.confirm")}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => (reopening ? send("reopen") : setReopening(true))}
          loading={reopening && mutation.isPending}
          disabled={mutation.isPending}
        >
          {reopening ? t("issues.resolve.sendReopen") : t("issues.resolve.reopen")}
        </Button>
        {reopening && (
          <Button variant="ghost" onClick={() => setReopening(false)}>
            {t("common.cancel")}
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-destructive">
        {error}
      </p>
    </section>
  );
}

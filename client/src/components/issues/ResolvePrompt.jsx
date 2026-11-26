import { useState } from "react";
import { FieldError } from "@/components/system/FieldError";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useResolveAnswer } from "@/hooks/useIssues";
import { t } from "@/i18n/t";
import { REOPEN_MIN } from "./issueRules";

/**
 * "Is it fixed?" under a resolved ticket, for its reporter: Confirm closes it, Reopen needs a reason of 10+
 * characters. Not optimistic: the ticket changes when the server answers (a 409 is handled in the hook).
 */
export function ResolvePrompt({ issue }) {
  const mutation = useResolveAnswer(issue.ticketId);
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
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
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
      <div className="flex flex-wrap gap-3">
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

import { useMutation } from "@tanstack/react-query";
import { SendIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/useApi";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { ChatAnswer } from "./ChatAnswer";

const SUGGESTIONS = ["chat.suggestMine", "chat.suggestHow"];
const errorKey = (error) => (error?.status === 429 ? "chat.limited" : "chat.failed");

/**
 * The conversation inside the help sheet. Held in memory only: closing the sheet clears it, and nothing
 * is saved on the server (decision M3-3). New answers are announced through the log role, so screen
 * readers hear them without moving focus.
 */
export function ChatPanel() {
  const api = useApi();
  const inputId = useId();
  const endRef = useRef(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const ask = useMutation({
    mutationFn: (message) => api("/api/chat", { method: "POST", body: { message } }),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length, ask.isPending]);

  async function send(message) {
    const question = message.trim();
    if (!question || ask.isPending) return;
    setText("");
    setMessages((m) => [...m, { from: "you", text: question }]);
    let answer;
    try {
      answer = await ask.mutateAsync(question);
    } catch (error) {
      answer = { error: errorKey(error) };
    }
    setMessages((m) => [...m, { from: "bot", answer }]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
      <div
        role="log"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
      >
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((key) => (
              <Button key={key} variant="outline" size="sm" onClick={() => send(t(key))}>
                {t(key)}
              </Button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] rounded-lg px-3 py-2",
              m.from === "you"
                ? "self-end bg-primary text-primary-foreground"
                : "self-start border bg-muted/40",
            )}
          >
            <span className="sr-only">{t(m.from === "you" ? "chat.you" : "chat.bot")}: </span>
            {m.from === "you" ? (
              <p className="whitespace-pre-line">{m.text}</p>
            ) : (
              <ChatAnswer answer={m.answer} />
            )}
          </div>
        ))}
        {ask.isPending && (
          <p className="self-start text-sm text-muted-foreground motion-safe:animate-pulse">
            {t("chat.thinking")}
          </p>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <Label htmlFor={inputId}>{t("chat.inputLabel")}</Label>
        <div className="flex items-end gap-2">
          <Textarea
            id={inputId}
            rows={2}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter makes a new line (the usual chat habit).
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            className="min-h-11 resize-none"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t("chat.send")}
            disabled={!text.trim() || ask.isPending}
          >
            <SendIcon aria-hidden="true" />
          </Button>
        </div>
      </form>
    </div>
  );
}

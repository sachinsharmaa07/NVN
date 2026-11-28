import { MessageCircleIcon } from "lucide-react";
import { useLocation } from "react-router";
import { LazyMenu } from "@/components/system/LazyMenu";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

// The sheet and the chat itself load lazily (LazyMenu); the bubble is here from the first paint.
const loadSheet = () => import("./ChatSheet");
/*
 * Help chat launcher (docs/UI.md §5): a 56px circle at the bottom right of every page.
 * Mobile: 16px above the bottom bar (64px + safe area), clear of the Report tile.
 * Desktop: 24px from the corner. Signed in, it opens the conversation; signed out, a sign-in step.
 *
 * Hidden on report step 2 (/report?step=2): the bubble would cover the map (UI.md §5).
 * Below 1024px it is hidden on every /report step too: the wizard's fixed Back/Next footer sits
 * exactly where the bubble floats, and would lose its Next button under it (decision FE-2).
 * The open Sheet (z-sheet) covers the bubble (z-chat), so it is never shown over its own panel.
 */
export function ChatBubble() {
  const { pathname, search } = useLocation();
  if (pathname === "/report" && new URLSearchParams(search).get("step") === "2") return null;

  return (
    <LazyMenu
      load={loadSheet}
      popup="dialog"
      trigger={
        <Button
          size="icon"
          aria-label={t("shell.chat.open")}
          className={cn(
            "fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] z-chat size-14 rounded-full shadow-md",
            "lg:right-6 lg:bottom-6",
            pathname === "/report" && "max-lg:hidden",
          )}
        >
          <MessageCircleIcon aria-hidden="true" className="size-6" />
        </Button>
      }
    />
  );
}

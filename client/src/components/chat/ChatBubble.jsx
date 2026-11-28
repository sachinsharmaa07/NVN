import { MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSignInPrompt } from "@/hooks/useSignInPrompt";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./ChatPanel";

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
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { status } = useAuth();
  const { openSignIn } = useSignInPrompt();
  const [open, setOpen] = useState(false);
  const signedIn = status === "signedIn";

  if (pathname === "/report" && new URLSearchParams(search).get("step") === "2") return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
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
      </SheetTrigger>
      {/* Bottom sheet on phones (no Vaul drawer yet), side panel on desktop. */}
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={cn("flex flex-col", !isDesktop && "h-[85dvh] rounded-t-xl")}
        style={isDesktop ? undefined : { paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="font-display text-xl">{t("chat.title")}</SheetTitle>
          <SheetDescription className="max-w-prose text-base">
            {t(signedIn ? "chat.intro" : "chat.signInBody")}
          </SheetDescription>
        </SheetHeader>
        {signedIn ? (
          <ChatPanel />
        ) : (
          <SheetFooter>
            {/* One overlay at a time (UI.md §6): this sheet closes before the sign-in one opens. */}
            <Button
              onClick={() => {
                setOpen(false);
                openSignIn({ returnTo: pathname + search });
              }}
            >
              {t("chat.signIn")}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

import { MessageCircleIcon } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

/*
 * Help chat launcher (docs/UI.md §5): a 56px circle at the bottom right of every page.
 * Mobile: 16px above the bottom bar (64px + safe area), clear of the Report tile.
 * Desktop: 24px from the corner. For now it opens a panel that says the chat is coming.
 *
 * Hidden on report step 2 (/report?step=2): the bubble would cover the map (UI.md §5).
 * The open Sheet (z-sheet) covers the bubble (z-chat), so it is never shown over its own panel.
 */
export function ChatBubble() {
  const { pathname, search } = useLocation();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (pathname === "/report" && new URLSearchParams(search).get("step") === "2") return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          aria-label={t("shell.chat.open")}
          className={cn(
            "fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] z-chat size-14 rounded-full shadow-md",
            "lg:right-6 lg:bottom-6",
          )}
        >
          <MessageCircleIcon aria-hidden="true" className="size-6" />
        </Button>
      </SheetTrigger>
      {/* Bottom sheet on phones (no Vaul drawer yet), side panel on desktop. */}
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={cn(!isDesktop && "rounded-t-xl")}
        style={isDesktop ? undefined : { paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="font-display text-xl">{t("shell.chat.title")}</SheetTitle>
          <SheetDescription className="max-w-prose text-base">
            {t("shell.chat.body")}
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose asChild>
            <Button asChild variant="secondary">
              <Link to="/report">{t("shell.nav.reportLong")}</Link>
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

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

/** The help chat sheet, loaded lazily by ChatBubble (components/system/LazyMenu.jsx). */
export default function ChatSheet({ trigger, defaultOpen }) {
  const { pathname, search } = useLocation();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { status } = useAuth();
  const { openSignIn } = useSignInPrompt();
  const [open, setOpen] = useState(defaultOpen);
  const signedIn = status === "signedIn";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
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

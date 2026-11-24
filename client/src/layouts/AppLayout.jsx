import { ScrollRestoration } from "react-router";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { BottomBar } from "@/components/nav/BottomBar";
import { Sidebar } from "@/components/nav/Sidebar";
import { SkipLink } from "@/components/nav/SkipLink";
import { TopBar } from "@/components/nav/TopBar";
import { PageTransition } from "./PageTransition";

/*
 * The frame around every page (docs/UI.md §5). Mobile-first:
 *   below 1024px  top bar / page / bottom bar fixed to the bottom (Report raised in it)
 *   1024px and up top bar / sidebar on the left + page; the bottom bar is hidden
 * Both navs are in the page and CSS shows one (lg:hidden / hidden lg:block). Choosing in CSS
 * instead of JS means the right one is there on the very first paint, with no jump.
 * The landing page (/) uses this same frame, so Report is one tap away from the first screen.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        {/*
          tabIndex -1 lets the skip link move focus here. Bottom padding = bottom bar height
          (64px + phone safe area) so the bar never covers the end of the page; none on desktop.
          `relative` is the anchor for the leaving page in PageTransition.
        */}
        <main
          id="main"
          tabIndex={-1}
          className="relative min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] outline-none lg:pb-0"
        >
          <PageTransition />
        </main>
      </div>
      <BottomBar />
      <ChatBubble />
      {/* Scrolls to the top on a new page and restores the old position on Back. */}
      <ScrollRestoration />
    </div>
  );
}

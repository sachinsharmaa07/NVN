import { useEffect, useSyncExternalStore } from "react";
import { Navigate, ScrollRestoration } from "react-router";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { BottomBar } from "@/components/nav/BottomBar";
import { Sidebar } from "@/components/nav/Sidebar";
import { SkipLink } from "@/components/nav/SkipLink";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { TopBar } from "@/components/nav/TopBar";
import { useAuth } from "@/hooks/useAuth";
import { useGuestLanguage } from "@/i18n/guestLanguage";
import { isLanguageLoaded, loadLanguage, onLanguageLoaded, setLanguage } from "@/i18n/t";
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
  // A suspended account may only see /suspended, on every route (public ones too).
  const { status, user } = useAuth();
  const guest = useGuestLanguage();
  const wanted = (user?.preferredLanguage ?? guest) === "hi" ? "hi" : "en";
  // Hindi is a lazy chunk: until it arrives the current (English) page stays, then the frame remounts in
  // Hindi. Never a flash of raw keys.
  const ready = useSyncExternalStore(onLanguageLoaded, () => isLanguageLoaded(wanted));
  const lang = ready ? wanted : "en";
  useEffect(() => {
    if (!ready) loadLanguage(wanted).catch(() => {}); // offline: stay in English, retry on next change
  }, [wanted, ready]);
  // Set before the children render, so every t() below uses it (see i18n/t.js).
  setLanguage(lang);
  // <html lang> picks the Devanagari line heights in globals.css and tells screen readers what to speak.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  if (status === "suspended") return <Navigate to="/suspended" replace />;

  // key: a language change remounts the frame, so no screen keeps strings from the old language.
  return (
    <div key={lang} className="flex min-h-dvh flex-col">
      <SkipLink />
      <TopBar />
      <OfflineBanner />
      <div className="flex flex-1">
        <Sidebar />
        {/*
          tabIndex -1 lets the skip link move focus here. content-reserve keeps the bottom bar and the
          chat bubble's zone free, so neither ever covers the end of the page (UI.md §5).
          PageTransition holds the view-transition boundary, so only the page area cross-fades.
        */}
        <main
          id="main"
          tabIndex={-1}
          className="relative min-w-0 flex-1 content-reserve outline-none"
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

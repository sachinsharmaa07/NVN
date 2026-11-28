import { Separator } from "@/components/ui/separator";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { LandingFooter } from "./LandingFooter";
import { StatsRow } from "./StatsRow";
import { TimelinePreview } from "./TimelinePreview";
import { TrustSection } from "./TrustSection";
import { useClaimPagePrimary } from "@/hooks/usePagePrimary";

// Sections below the hero fade up as they scroll in (CSS only, UI.md §4). Where the browser has no
// scroll timelines, or the user asks for less motion, they are simply there.
const REVEAL = "reveal-on-scroll";

/**
 * Public landing page. Order: what Nivaran does + the pincode form (hero), the three steps,
 * the numbers so far, an example ticket, and why you can trust it. One <h1>, in the hero.
 */
export function Landing() {
  // Check my pincode: its own primary button, so the sidebar's Report turns outline (one primary per screen).
  useClaimPagePrimary();
  return (
    <div className="flex flex-col">
      <Hero />
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8">
        <Separator />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 md:px-6 lg:gap-16 lg:px-8 lg:py-16">
        <HowItWorks className={REVEAL} />
        <StatsRow className={REVEAL} />
        <TimelinePreview className={REVEAL} />
        <TrustSection className={REVEAL} />
      </div>
      <LandingFooter />
    </div>
  );
}

export default Landing;

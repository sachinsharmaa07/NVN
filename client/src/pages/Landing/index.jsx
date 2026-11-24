import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { LandingFooter } from "./LandingFooter";
import { StatsRow } from "./StatsRow";
import { TimelinePreview } from "./TimelinePreview";
import { TrustSection } from "./TrustSection";

/**
 * Public landing page. Order: what Nivaran does + the pincode form (hero), the three steps,
 * sample numbers, an example ticket, and why you can trust it. One <h1>, in the hero.
 */
export function Landing() {
  return (
    <div className="flex flex-col">
      <Hero />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 md:px-6 lg:gap-16 lg:px-8 lg:py-16">
        <HowItWorks />
        <StatsRow />
        <TimelinePreview />
        <TrustSection />
      </div>
      <LandingFooter />
    </div>
  );
}

export default Landing;

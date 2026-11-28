import { ArrowDownIcon } from "lucide-react";
import { t } from "@/i18n/t";
import { PincodeInput } from "./PincodeInput";
import { HOW_IT_WORKS_ID } from "./constants";

// An in-page anchor. Smooth or instant comes from CSS (html scroll-behavior, off under reduced
// motion); this only moves focus to the heading too, so keyboard and screen reader users land
// in the same place as everyone else.
function goToHowItWorks(event) {
  const target = document.getElementById(HOW_IT_WORKS_ID);
  if (!target) return; // let the plain #anchor do its job
  event.preventDefault();
  target.scrollIntoView({ block: "start" });
  target.focus({ preventScroll: true });
}

/**
 * First screen: the promise on the left, the pincode slip on the right as the page's one bold
 * object. Renders straight away with no entrance animation: the h1 is the LCP element.
 */
export function Hero() {
  return (
    <section aria-labelledby="landing-hero-title">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-12 md:px-6 lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <h1
            id="landing-hero-title"
            // UI.md §1 display role: 31px on phones, 49px on desktop (39px in between).
            className="max-w-xl font-display text-h2 font-semibold md:text-h1 lg:max-w-2xl lg:text-display"
          >
            {t("landing.hero.title")}
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">{t("landing.hero.body")}</p>
          <a
            href={`#${HOW_IT_WORKS_ID}`}
            onClick={goToHowItWorks}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            <ArrowDownIcon aria-hidden="true" className="size-4" />
            {t("landing.hero.howLink")}
          </a>
        </div>

        <div className="rounded-lg border bg-card p-4 xs:p-6 lg:col-span-5 lg:p-8">
          <PincodeInput />
        </div>
      </div>
    </section>
  );
}

import { ArrowDownIcon } from "lucide-react";
import { t } from "@/i18n/t";
import { PincodeInput } from "./PincodeInput";
import { HOW_IT_WORKS_ID } from "./constants";

// Scrolls to "How it works" and moves focus there, so keyboard and screen reader users land
// in the same place as everyone else. Smooth only when the user hasn't asked for less motion.
function goToHowItWorks(event) {
  const target = document.getElementById(HOW_IT_WORKS_ID);
  if (!target) return; // let the plain #anchor do its job
  event.preventDefault();
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
}

/**
 * First screen. Renders straight away with no entrance animation: the h1 is the LCP element,
 * and hiding it behind an opacity-0 start would delay it.
 */
export function Hero() {
  return (
    <section aria-labelledby="landing-hero-title" className="border-b">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-4">
          <h1
            id="landing-hero-title"
            className="max-w-xl font-display text-3xl font-semibold text-balance lg:text-4xl"
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

        {/* The one bold thing on the page: the pincode form, set like a counter slip. */}
        <div className="rounded-lg border bg-card p-4 md:p-6">
          <PincodeInput />
        </div>
      </div>
    </section>
  );
}

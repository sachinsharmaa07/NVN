import { FormStrip } from "@/components/system/FormStrip";
import { t } from "@/i18n/t";
import { HOW_IT_WORKS_ID } from "./constants";

const STEPS = ["pincode", "pin", "ticket"];

/**
 * Three steps, in order, so a numbered list is honest here. One ruled strip (UI.md §5.1 form strip)
 * instead of three identical cards; no current step, because nobody has started yet.
 */
export function HowItWorks({ className }) {
  const steps = STEPS.map((key) => ({
    title: t(`landing.how.${key}Title`),
    body: t(`landing.how.${key}Body`),
  }));
  return (
    <section aria-labelledby={HOW_IT_WORKS_ID} className={className}>
      {/* tabIndex -1 lets the hero link move focus here; scroll-mt clears the sticky header. */}
      <h2
        id={HOW_IT_WORKS_ID}
        tabIndex={-1}
        className="mb-6 scroll-mt-16 font-display text-2xl font-semibold lg:text-h2 outline-none"
      >
        {t("landing.how.title")}
      </h2>
      <FormStrip steps={steps} />
    </section>
  );
}

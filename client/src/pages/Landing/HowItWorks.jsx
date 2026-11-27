import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { MapPinnedIcon, MailboxIcon, TicketIcon } from "lucide-react";
import { t } from "@/i18n/t";
import { fadeUp, stagger } from "@/lib/motion";
import { HOW_IT_WORKS_ID } from "./constants";

const STEPS = [
  { key: "pincode", Icon: MailboxIcon },
  { key: "pin", Icon: MapPinnedIcon },
  { key: "ticket", Icon: TicketIcon },
];

/**
 * Three steps, in order, so a numbered list is honest here. They fade up one after another the
 * first time they scroll into view (transform + opacity only, space already reserved, so no
 * layout shift). With reduced motion they are simply there.
 */
export function HowItWorks() {
  const reduce = useReducedMotion();
  const reveal = reduce
    ? {}
    : {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, amount: 0.2 },
        variants: stagger(),
      };

  return (
    <section aria-labelledby={HOW_IT_WORKS_ID} className="flex flex-col gap-6">
      {/* tabIndex -1 lets the hero link move focus here; scroll-mt clears the sticky header. */}
      <h2
        id={HOW_IT_WORKS_ID}
        tabIndex={-1}
        className="scroll-mt-16 font-display text-2xl font-semibold outline-none"
      >
        {t("landing.how.title")}
      </h2>
      <m.ol {...reveal} className="grid gap-4 md:grid-cols-3 md:gap-6">
        {STEPS.map(({ key, Icon }, index) => (
          <m.li
            key={key}
            variants={reduce ? undefined : fadeUp}
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {t("landing.how.stepNumber", { number: index + 1, total: STEPS.length })}
              </span>
            </div>
            <h3 className="font-display text-xl font-semibold">{t(`landing.how.${key}Title`)}</h3>
            <p className="text-muted-foreground">{t(`landing.how.${key}Body`)}</p>
          </m.li>
        ))}
      </m.ol>
    </section>
  );
}

import { cn } from "@/lib/utils";

// Full class names, so Tailwind can find them in the source (it can't see names built at runtime).
const COLUMNS = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

/**
 * Numbered steps in a strip with 1px rules (02-lld §2): the report wizard's step bar (with `current`)
 * and Landing's "How it works" (without). Stacked with rules between below 768px, one row from 768px.
 * Screen readers hear each item as number, title, body; the current one is announced as the current step.
 * `collapsed`: below 768px only the current step shows (the wizard on a phone, where three stacked rows
 * would push the form below the fold); the page must still say "Step n of N" for screen readers.
 * `stepLabel` ("Step 3 of 3") shows beside the number while collapsed, so a lone "3" reads as progress.
 */
export function FormStrip({
  steps,
  current,
  collapsed = false,
  stepLabel,
  as: List = "ol",
  className,
}) {
  return (
    <List
      data-slot="form-strip"
      className={cn(
        "divide-y divide-border rounded-lg border md:grid md:divide-x md:divide-y-0",
        COLUMNS[steps.length],
        className,
      )}
    >
      {steps.map((step, i) => {
        const isCurrent = current === i;
        return (
          <li
            key={step.title}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex flex-col gap-2 p-4 md:p-6",
              collapsed && !isCurrent && "max-md:hidden",
            )}
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-sm border border-input font-display font-semibold tabular-nums transition-colors duration-fast ease-standard",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {i + 1}
              </span>
              {/* Visual only: the page's own "Step n of N" heading speaks for screen readers. */}
              {collapsed && isCurrent && stepLabel && (
                <span aria-hidden="true" className="text-sm text-muted-foreground md:hidden">
                  {stepLabel}
                </span>
              )}
            </span>
            <span className="font-display text-h3 font-semibold text-foreground">{step.title}</span>
            {step.body && <span className="text-muted-foreground">{step.body}</span>}
          </li>
        );
      })}
    </List>
  );
}

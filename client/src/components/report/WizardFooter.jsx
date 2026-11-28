import { useId } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

/**
 * The wizard's Back / Next row (02-lld §2). Below 1024px it is fixed just above the bottom bar, so
 * Next is always under the thumb; from 1024px it is an ordinary row at the end of the step.
 * A disabled Next says why: `disabledHint` sits under it and is linked with aria-describedby.
 * `nextType="submit"` makes Next submit the step's own <form> (the details step).
 */
export function WizardFooter({
  onBack,
  onNext,
  nextLabel = t("report.wizard.next"),
  nextDisabled = false,
  disabledHint,
  submitting = false,
  nextType = "button",
}) {
  const hintId = useId();
  const showHint = nextDisabled && !submitting && Boolean(disabledHint);
  return (
    <div
      data-slot="wizard-footer"
      className={cn(
        "fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-bottombar border-t bg-background p-4 shadow-md",
        "lg:static lg:border-t-0 lg:bg-transparent lg:p-0 lg:shadow-none",
      )}
    >
      <div className="mx-auto flex w-full max-w-160 flex-col gap-2">
        <div className={cn("flex gap-3", onBack ? "justify-between" : "justify-end")}>
          {onBack && (
            <Button type="button" variant="outline" size="lg" onClick={onBack}>
              {t("report.wizard.back")}
            </Button>
          )}
          <Button
            type={nextType}
            size="lg"
            onClick={onNext}
            disabled={nextDisabled || submitting}
            loading={submitting}
            aria-describedby={showHint ? hintId : undefined}
          >
            {nextLabel}
          </Button>
        </div>
        {showHint && (
          <p id={hintId} className="text-right text-sm text-muted-foreground">
            {disabledHint}
          </p>
        )}
      </div>
    </div>
  );
}

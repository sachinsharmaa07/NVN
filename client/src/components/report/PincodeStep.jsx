import { useState } from "react";
import { PincodeField } from "@/components/report/PincodeField";
import { pincodeError } from "@/pages/Landing/pincode";
import { PincodeResult } from "@/components/report/PincodeResult";
import { saveDraft } from "@/components/report/reportDraft";
import { StepBody } from "@/components/report/StepSlide";
import { WizardFooter } from "@/components/report/WizardFooter";
import { useLookupPincode } from "@/hooks/useLookupPincode";
import { t } from "@/i18n/t";

/**
 * Report step 1. The lookup runs on the 6th digit and is announced (aria-live); the resident moves
 * on with Next, never automatically (WCAG 3.2.2). Next only enables for a served pincode.
 */
export function PincodeStep({ initialPin, onNext }) {
  const [pin, setPin] = useState(initialPin);
  const [error, setError] = useState("");
  const lookup = useLookupPincode(pin);
  const complete = pin.length === 6 && !pincodeError(pin);
  const canGoOn = complete && lookup.data?.served === true;

  function change(next) {
    setPin(next);
    saveDraft({ pincode: next });
    // A full 6 digits is checked at once; fewer only after blur, so typing isn't scolded.
    setError(next.length === 6 || error ? pincodeError(next) : "");
  }

  return (
    <div className="flex flex-col gap-6">
      <StepBody className="flex flex-col gap-6">
        <PincodeField
          value={pin}
          onChange={change}
          onBlur={() => pin && setError(pincodeError(pin))}
          error={error}
        />
        <section aria-live="polite" aria-label={t("report.pincode.resultLabel")}>
          {complete && <PincodeResult pin={pin} lookup={lookup} />}
        </section>
      </StepBody>
      <WizardFooter
        onNext={() => onNext(pin)}
        nextDisabled={!canGoOn}
        // Only "too short" has a hint: a full pincode we don't serve shows the waitlist above instead.
        disabledHint={complete ? undefined : t("report.wizard.hintPincode")}
      />
    </div>
  );
}

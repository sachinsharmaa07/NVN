import { useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { PincodeField } from "@/components/report/PincodeField";
import { PincodeResult } from "@/components/report/PincodeResult";
import { Button } from "@/components/ui/button";
import { useLookupPincode } from "@/hooks/useLookupPincode";
import { isValidPincode, pincodeError } from "@/pages/Landing/pincode";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

/**
 * The landing page's pincode form. Six valid digits look the area up (public API, no sign-in):
 * a served pincode shows its place and turns the button into "Report in {pincode}"; one we don't
 * cover shows the waitlist instead, and the button goes away.
 */
export function PincodeInput({ className }) {
  const navigate = useNavigate();
  const formId = useId();
  const inputRef = useRef(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const lookup = useLookupPincode(value);
  const complete = isValidPincode(value);
  const served = complete && lookup.data?.served === true;
  const notCovered =
    complete && (lookup.error?.code === "PINCODE_NOT_FOUND" || lookup.data?.served === false);

  function handleChange(next) {
    setValue(next);
    // Validate on blur first; once an error is showing, re-check on every change so it clears.
    if (error) setError(pincodeError(next));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const message = pincodeError(value);
    if (message) {
      setError(message);
      inputRef.current?.focus();
      return;
    }
    if (served) navigate(`/report?pincode=${value}`);
  }

  // The result sits outside the <form> because the waitlist inside it is a form of its own (forms
  // can't nest); the submit button joins this form through its `form` attribute.
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <form id={formId} noValidate onSubmit={handleSubmit}>
        <PincodeField
          value={value}
          onChange={handleChange}
          // Tabbing past an empty field is not a mistake, so only check what was typed.
          onBlur={() => value && setError(pincodeError(value))}
          error={error}
          inputRef={inputRef}
        />
      </form>
      {complete && <PincodeResult pin={value} lookup={lookup} />}
      {!notCovered && (
        <Button type="submit" form={formId} size="lg" className="w-full sm:w-fit">
          {served ? t("landing.pincode.reportIn", { pincode: value }) : t("landing.pincode.submit")}
        </Button>
      )}
    </div>
  );
}

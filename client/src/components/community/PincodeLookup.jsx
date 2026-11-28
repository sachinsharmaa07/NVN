import { useEffect, useId, useRef, useState } from "react";
import { PincodeField } from "@/components/report/PincodeField";
import { Button } from "@/components/ui/button";
import { useLookupPincode } from "@/hooks/useLookupPincode";
import { t } from "@/i18n/t";
import { isValidPincode, pincodeError } from "@/pages/Landing/pincode";

/**
 * Read any pincode's posts with no home pincode set: the PIN boxes, like Landing and the report.
 * Six digits look the pincode up and show its posts on their own; "Show posts" is there for people who
 * expect a button. Typing mistakes get Landing's messages; a pincode we don't cover says so inline.
 */
export function PincodeLookup({ onShow }) {
  const formId = useId();
  const inputRef = useRef(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const lookup = useLookupPincode(value);
  const complete = isValidPincode(value);
  const served = complete && lookup.data?.served === true;
  const notCovered =
    complete && (lookup.error?.code === "PINCODE_NOT_FOUND" || lookup.data?.served === false);
  const failed = complete && lookup.isError && !notCovered;

  // A served pincode opens its posts as soon as the lookup answers (no extra tap).
  useEffect(() => {
    if (served) onShow(value);
  }, [served, value, onShow]);

  function handleChange(next) {
    setValue(next);
    // Validate on blur first; once an error is showing, re-check on every change so it clears.
    if (error) setError(pincodeError(next));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const message = pincodeError(value);
    setError(message);
    if (message) inputRef.current?.focus();
  }

  const shown =
    error ||
    (notCovered && t("community.lookup.notServed", { pincode: value })) ||
    (failed && t("errors.common.network")) ||
    "";

  return (
    <form id={formId} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PincodeField
        value={value}
        onChange={handleChange}
        // Tabbing past an empty field is not a mistake, so only check what was typed.
        onBlur={() => value && setError(pincodeError(value))}
        error={shown}
        inputRef={inputRef}
        label={t("community.lookup.label")}
        hint={t("community.lookup.hint")}
        name="community-pincode"
      />
      <Button type="submit" variant="outline" className="w-fit">
        {t("community.switch.submit")}
      </Button>
    </form>
  );
}

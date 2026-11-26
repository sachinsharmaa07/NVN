import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { PincodeField } from "@/components/report/PincodeField";
import { pincodeError } from "@/pages/Landing/pincode";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

/** The landing page's pincode form: validates, then opens /report?pincode=... */
export function PincodeInput({ className }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

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
    navigate(`/report?pincode=${value}`);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className={cn("flex flex-col gap-4", className)}>
      <PincodeField
        value={value}
        onChange={handleChange}
        // Tabbing past an empty field is not a mistake, so only check what was typed.
        onBlur={() => value && setError(pincodeError(value))}
        error={error}
        inputRef={inputRef}
      />
      <Button type="submit" size="lg" className="w-full sm:w-fit">
        {t("landing.pincode.submit")}
      </Button>
    </form>
  );
}

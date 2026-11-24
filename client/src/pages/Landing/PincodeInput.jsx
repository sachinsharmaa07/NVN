import { useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FieldError } from "@/components/system/FieldError";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { cleanPincode, isValidPincode, PINCODE_HTML_PATTERN } from "./pincode";

const BOXES = [0, 1, 2, 3, 4, 5];

// Returns the error message for a pincode, or "" when it is fine.
function pincodeError(value) {
  if (value.length === 0) return t("landing.pincode.errorEmpty");
  if (value.length < 6) return t("landing.pincode.errorShort", { count: value.length });
  if (!isValidPincode(value)) return t("landing.pincode.errorLeadingZero");
  return "";
}

/**
 * The pincode as six boxes, like the PIN boxes on an India Post envelope (docs/UI.md §1).
 * It is ONE real <input> (screen readers hear one field, autofill and paste just work) laid
 * over six decorative boxes. The input's own text is transparent; the boxes draw the digits.
 */
export function PincodeInput({ className }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);

  function handleChange(event) {
    const next = cleanPincode(event.target.value);
    setValue(next);
    // Validate on blur first; once an error is showing, re-check on every change so it clears.
    if (error) setError(pincodeError(next));
  }

  function handleBlur() {
    setFocused(false);
    // Tabbing past an empty field is not a mistake, so only check what was typed.
    if (value) setError(pincodeError(value));
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

  // The box that the next digit goes into; it gets the highlight and the caret.
  const activeIndex = Math.min(value.length, 5);

  return (
    <form noValidate onSubmit={handleSubmit} className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-base font-medium">
          {t("landing.pincode.label")}
        </label>
        {/* Keyboard focus ring goes around the whole row because the input itself is invisible.
            Boxes are 40px wide at 360px screens so all six fit inside the card; the tap target
            is the whole 56px-tall row, so it stays above 44px. */}
        <div className="relative w-fit rounded-md has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-4 has-[input:focus-visible]:ring-offset-background">
          <div aria-hidden="true" className="flex gap-2 sm:gap-3">
            {BOXES.map((i) => (
              <span
                key={i}
                className={cn(
                  "flex h-14 w-10 items-center justify-center rounded-sm border-2 bg-card font-display text-3xl font-semibold tabular-nums transition-colors duration-fast ease-standard sm:h-16 sm:w-12",
                  error ? "border-destructive" : "border-input",
                  focused && i === activeIndex && !error && "border-primary",
                )}
              >
                {value[i] ??
                  (focused && i === activeIndex && <span className="h-7 w-0.5 bg-primary" />)}
              </span>
            ))}
          </div>
          <input
            ref={inputRef}
            id={id}
            name="pincode"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            pattern={PINCODE_HTML_PATTERN}
            maxLength={6}
            value={value}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            // Covers the boxes so a tap anywhere on them focuses the field. text-base (16px)
            // stops iOS zooming in; the text and caret are transparent because the boxes show them.
            className="absolute inset-0 size-full cursor-text rounded-md bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent"
          />
        </div>
        <p id={hintId} className="text-sm text-muted-foreground">
          {t("landing.pincode.hint")}
        </p>
        {/* The wrapper stays in the DOM so screen readers announce the message when it appears. */}
        <div aria-live="polite">
          <FieldError id={errorId}>{error}</FieldError>
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-fit">
        {t("landing.pincode.submit")}
      </Button>
    </form>
  );
}

import { useId, useState } from "react";
import { FieldError } from "@/components/system/FieldError";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { cleanPincode, PINCODE_HTML_PATTERN } from "@/pages/Landing/pincode";

const BOXES = [0, 1, 2, 3, 4, 5];

/**
 * The pincode as six boxes, like the PIN boxes on an India Post envelope (docs/UI.md §1).
 * It is ONE real <input> (screen readers hear one field, autofill and paste just work) laid
 * over six decorative boxes. The input's own text is transparent; the boxes draw the digits.
 * Controlled: `value` is digits only; onChange gets the cleaned value.
 */
export function PincodeField({ value, onChange, onBlur, error, inputRef }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [focused, setFocused] = useState(false);
  // The box that the next digit goes into; it gets the highlight and the caret.
  const activeIndex = Math.min(value.length, 5);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-medium">
        {t("landing.pincode.label")}
      </label>
      {/* Keyboard focus ring goes around the whole row because the input itself is invisible.
          Boxes are 36px under 360px and 40px from 360px so all six fit at 320px; the tap target is the 56px-tall row. */}
      <div className="relative w-fit rounded-md has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-4 has-[input:focus-visible]:ring-offset-background">
        <div aria-hidden="true" className="flex gap-2 sm:gap-3">
          {BOXES.map((i) => (
            <span
              key={i}
              className={cn(
                "flex h-14 w-9 items-center justify-center rounded-sm border-2 bg-card font-display text-3xl font-semibold tabular-nums transition-colors duration-fast ease-standard min-[360px]:w-10 sm:h-16 sm:w-12",
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
          onChange={(event) => onChange(cleanPincode(event.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
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
  );
}

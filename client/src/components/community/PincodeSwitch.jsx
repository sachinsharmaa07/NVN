import { useId, useState } from "react";
import { FieldError } from "@/components/system/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n/t";

const PIN_RE = /^[1-9][0-9]{5}$/;

/** "Read another pincode": a plain field, so the stamp above stays the only boxed pincode on the page. */
export function PincodeSwitch({ onShow }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!PIN_RE.test(value)) {
      setError(t("community.switch.error"));
      return;
    }
    setError("");
    onShow(value);
    setValue("");
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("community.switch.label")}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-36 tabular-nums"
        />
        <Button type="submit" variant="outline">
          {t("community.switch.submit")}
        </Button>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </form>
  );
}

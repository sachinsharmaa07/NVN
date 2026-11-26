import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { FieldError } from "@/components/system/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/useApi";
import { t } from "@/i18n/t";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Inline waitlist for a pincode we don't cover (or don't know). POST /api/waitlist is idempotent. */
export function WaitlistForm({ pin }) {
  const api = useApi();
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const join = useMutation({
    mutationFn: () => api("/api/waitlist", { method: "POST", body: { pin, email: email.trim() } }),
    onError: (err) => setError(err.message),
  });

  if (join.isSuccess) {
    return (
      <p role="status" className="text-sm">
        {t("report.pincode.waitlistDone", { pincode: pin })}
      </p>
    );
  }

  function submit(event) {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError(t("report.pincode.waitlistEmailError"));
      return;
    }
    setError("");
    join.mutate();
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-2">
        <Label htmlFor={id}>{t("report.pincode.waitlistLabel")}</Label>
        <Input
          id={id}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
        />
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {t("report.pincode.waitlistHint")}
        </p>
        <div aria-live="polite">
          <FieldError id={`${id}-error`}>{error}</FieldError>
        </div>
      </div>
      <Button
        type="submit"
        variant="secondary"
        disabled={join.isPending}
        className="w-full sm:w-fit"
      >
        {join.isPending ? t("report.pincode.waitlistSending") : t("report.pincode.waitlistSubmit")}
      </Button>
    </form>
  );
}

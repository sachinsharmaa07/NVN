import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FieldError } from "@/components/system/FieldError";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useUpdateProfile } from "@/hooks/useUpdateProfile";
import { t } from "@/i18n/t";
import { serverFieldErrors } from "@/lib/fieldErrors";
import { useClaimPagePrimary } from "@/hooks/usePagePrimary";
import { DetailsSection, HomePincodeSection, LanguageSection } from "./ProfileSections";

// Mirrors the server's strict PATCH /api/me schema: these three keys and nothing else.
const schema = z.object({
  name: z.string().trim().min(1, t("profile.form.nameError")).max(100, t("profile.form.nameError")),
  preferredLanguage: z.enum(["en", "hi"]),
  defaultPincode: z.union([
    z.literal(""),
    z.string().regex(/^[1-9][0-9]{5}$/, t("profile.form.pincodeError")),
  ]),
});

const toValues = (user) => ({
  name: user.name ?? "",
  preferredLanguage: user.preferredLanguage ?? "en",
  defaultPincode: user.defaultPincode ?? "",
});

export function ProfileForm({ user }) {
  const save = useUpdateProfile();
  // Save changes: its own primary button, so the sidebar's Report turns outline (one primary per screen).
  useClaimPagePrimary();
  const [formError, setFormError] = useState("");
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: toValues(user),
    mode: "onBlur", // validate on blur, then on every change once an error shows (UI.md §6)
  });
  const { reset, setError, setFocus } = form;

  // When the server's copy of the user changes (e.g. a refetch after you switch tabs), refresh the
  // form, but never over edits in progress.
  const { isDirty } = form.formState;
  useEffect(() => {
    if (!isDirty) reset(toValues(user));
  }, [user, isDirty, reset]);

  // Server field errors become our own wording (never the server's text), keyed by field.
  const FIELD_COPY = {
    name: t("profile.form.nameError"),
    defaultPincode: t("profile.form.pincodeError"),
  };

  async function onSubmit(values) {
    setFormError("");
    try {
      const saved = await save.mutateAsync({
        name: values.name,
        preferredLanguage: values.preferredLanguage,
        defaultPincode: values.defaultPincode || null, // empty box means "no default"
      });
      reset(toValues(saved.user)); // the saved values are the new "clean" state
    } catch (error) {
      const fields = serverFieldErrors(error).filter(([name]) => name in values);
      if (error.code === "VALIDATION_ERROR" && fields.length) {
        fields.forEach(([name]) =>
          setError(name, { message: FIELD_COPY[name] ?? t("errors.common.validation") }),
        );
        setFocus(fields[0][0]); // first invalid field gets focus
      }
      // Network, 5xx and other errors: shown inline; the edits stay in the form.
      setFormError(error.message);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
        <DetailsSection control={form.control} user={user} />
        <Separator />
        <HomePincodeSection control={form.control} />
        <Separator />
        <LanguageSection control={form.control} />

        {formError && (
          <div role="alert">
            <FieldError>{formError}</FieldError>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {/* Same label while saving: the spinner joins it, so the button keeps its width. */}
          <Button type="submit" loading={save.isPending}>
            {t("profile.form.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!form.formState.isDirty || save.isPending}
            onClick={() => {
              reset(toValues(user));
              setFormError("");
            }}
          >
            {t("profile.form.cancel")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

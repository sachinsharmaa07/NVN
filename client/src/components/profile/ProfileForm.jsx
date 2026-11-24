import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FieldError } from "@/components/system/FieldError";
import { RoleBadge } from "@/components/auth/RoleBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateProfile } from "@/hooks/useUpdateProfile";
import { t } from "@/i18n/t";
import { serverFieldErrors } from "@/lib/fieldErrors";
import { areaLabel } from "@/lib/roles";

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

  const area = areaLabel(user, t("profile.form.areaAll")) || t("profile.form.areaNone");
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("profile.form.name")}</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="preferredLanguage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("profile.form.language")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger ref={field.ref}>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="en">{t("profile.form.languageEn")}</SelectItem>
                  <SelectItem value="hi">{t("profile.form.languageHi")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="defaultPincode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("profile.form.pincode")}</FormLabel>
              <FormControl>
                <Input inputMode="numeric" maxLength={6} autoComplete="postal-code" {...field} />
              </FormControl>
              <FormDescription>{t("profile.form.pincodeHint")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Read-only facts are plain text (reachable by screen readers), not disabled inputs. */}
        <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[8rem_1fr]">
          <dt className="text-sm text-muted-foreground">{t("profile.form.email")}</dt>
          <dd className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-all">{user.email}</span>
              <Badge variant="outline">
                {t(user.emailVerified ? "profile.form.verified" : "profile.form.notVerified")}
              </Badge>
            </span>
            <span className="text-sm text-muted-foreground">{t("profile.form.emailHint")}</span>
          </dd>
          <dt className="text-sm text-muted-foreground">{t("profile.form.role")}</dt>
          <dd>
            <RoleBadge role={user.role} />
          </dd>
          <dt className="text-sm text-muted-foreground">{t("profile.form.area")}</dt>
          <dd>{area}</dd>
        </dl>

        {formError && (
          <div role="alert">
            <FieldError>{formError}</FieldError>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={save.isPending}>
            {save.isPending ? t("profile.form.saving") : t("profile.form.save")}
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

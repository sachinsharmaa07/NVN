import { MailCheckIcon, MailWarningIcon } from "lucide-react";
import { RoleBadge } from "@/components/auth/RoleBadge";
import { PincodeField } from "@/components/report/PincodeField";
import { StateBadge } from "@/components/system/StateBadge";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n/t";
import { areaLabel } from "@/lib/roles";

// The profile form's three titled parts. ProfileForm owns the form state and submit; each section gets
// the react-hook-form `control` and renders its own fields.

/** Name (editable) and the read-only facts: email, role, area. */
export function DetailsSection({ control, user }) {
  const area = areaLabel(user, t("profile.form.areaAll")) || t("profile.form.areaNone");
  return (
    <Section title={t("profile.section.details")}>
      <FormField
        control={control}
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
      {/* Read-only facts are plain text (reachable by screen readers), not disabled inputs. */}
      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[8rem_1fr]">
        <dt className="text-sm text-muted-foreground">{t("profile.form.email")}</dt>
        <dd className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{user.email}</span>
            <StateBadge
              tone={user.emailVerified ? "good" : "bad"}
              icon={user.emailVerified ? MailCheckIcon : MailWarningIcon}
            >
              {t(user.emailVerified ? "profile.form.verified" : "profile.form.notVerified")}
            </StateBadge>
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
    </Section>
  );
}

/** The default pincode, in the six PIN boxes as in the report. */
export function HomePincodeSection({ control }) {
  return (
    <Section title={t("profile.section.pincode")}>
      <FormField
        control={control}
        name="defaultPincode"
        // The six PIN boxes, as in the report: the pincode looks the same wherever you type it.
        render={({ field, fieldState }) => (
          <PincodeField
            label={t("profile.form.pincode")}
            hint={t("profile.form.pincodeHint")}
            name={field.name}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={fieldState.error?.message}
          />
        )}
      />
    </Section>
  );
}

/** The app's language. */
export function LanguageSection({ control }) {
  return (
    <Section title={t("profile.section.language")}>
      <FormField
        control={control}
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
    </Section>
  );
}

// One titled part of the form (an h2: the page title is the h1).
function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-h3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

import { useRef, useState } from "react";
import { toast } from "sonner";
import { adminErrorMessage } from "@/components/admin/adminErrors";
import { REASON_MAX, REASON_MIN } from "@/components/admin/reasonLimits";
import { RoleFormFields } from "@/components/admin/RoleFormFields";
import { FieldError } from "@/components/system/FieldError";
import { ResponsiveDialog } from "@/components/system/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useChangeRole } from "@/hooks/useChangeRole";
import { useCities } from "@/hooks/useCities";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDepartments } from "@/hooks/useDepartments";
import { t } from "@/i18n/t";
import { serverFieldErrors } from "@/lib/fieldErrors";
import { assignableRoles, isCityBound, levelOf, roleName, roleNeeds } from "@/lib/roles";

/*
 * Change a user's role. Pessimistic: the button shows a spinner and the dialog stays open until
 * the server answers; only then it closes and the list refreshes. Errors show inside the dialog.
 * `actor` is the signed-in admin, `user` the person being changed. The page gives each opening a
 * new `key`, so a reopened dialog always starts empty (no old reason, role or error).
 */
export function RoleChangeDialog({ user, actor, open, onOpenChange, onGone, returnFocusRef }) {
  const name = user.name || user.email;
  const mutation = useChangeRole();
  const roleRef = useRef(null);
  const cityFixed = isCityBound(actor); // a city admin can only work inside their city
  const [form, setForm] = useState({
    role: "",
    reason: "",
    cityId: cityFixed ? (actor.cityId ?? "") : (user.cityId ?? ""),
    departmentId: user.departmentId ?? "",
    stateCode: user.stateCode ?? "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const needs = roleNeeds(form.role);
  const [cityQuery, setCityQuery] = useState("");
  const cities = useCities({ enabled: needs.city, q: useDebouncedValue(cityQuery) });
  const departments = useDepartments(needs.department ? form.cityId : "");
  const reasonLength = form.reason.trim().length;
  const valid =
    form.role &&
    reasonLength >= REASON_MIN &&
    reasonLength <= REASON_MAX &&
    (!needs.city || form.cityId) &&
    (!needs.department || form.departmentId) &&
    (!needs.state || form.stateCode);
  const roleLabel = form.role ? roleName(form.role) : "";
  const needsMfa = levelOf(form.role) >= 4;

  // Closing is ignored while the request is running: the answer would have nowhere to show.
  const requestClose = (next) => {
    if (!next && mutation.isPending) return;
    onOpenChange(next);
  };

  async function submit() {
    setError("");
    setFieldErrors({});
    try {
      await mutation.mutateAsync({
        id: user.id,
        role: form.role,
        reason: form.reason.trim(),
        // Only the scope fields the new role needs; the server rejects the others.
        ...(needs.city && { cityId: form.cityId }),
        ...(needs.department && { departmentId: form.departmentId }),
        ...(needs.state && { stateCode: form.stateCode }),
      });
      toast.success(
        needsMfa ? t("admin.role.doneMfa", { name }) : t("admin.role.done", { role: roleLabel }),
      );
      onOpenChange(false);
    } catch (e) {
      if (e.code === "NOT_FOUND") {
        // They left the actor's area (or were removed) while the dialog was open.
        toast(t("admin.users.gone"));
        onOpenChange(false);
        onGone?.();
        return;
      }
      if (e.code === "VALIDATION_ERROR") setFieldErrors(Object.fromEntries(serverFieldErrors(e)));
      setError(adminErrorMessage(e, "role"));
    }
  }

  const options = assignableRoles(actor.role);
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={requestClose}
      title={t("admin.role.title", { name })}
      description={`${user.email}. ${t("admin.role.current", { role: roleName(user.role) })}`}
      contentProps={{
        // Focus starts on the Role select; on close it goes back to the row's Actions button.
        onOpenAutoFocus: (event) => {
          event.preventDefault();
          roleRef.current?.focus();
        },
        onCloseAutoFocus: (event) => {
          event.preventDefault();
          returnFocusRef?.current?.focus();
        },
      }}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => requestClose(false)}
            disabled={mutation.isPending}
          >
            {t("admin.role.cancel")}
          </Button>
          <Button onClick={submit} disabled={!valid} loading={mutation.isPending}>
            {mutation.isPending
              ? t("admin.role.confirming")
              : t("admin.role.confirm", { role: roleLabel || "…" })}
          </Button>
        </>
      }
    >
      {options.length === 0 ? (
        <p>{t("admin.role.none")}</p>
      ) : (
        <>
          <RoleFormFields
            name={name}
            options={options}
            form={form}
            setForm={setForm}
            needs={needs}
            needsMfa={needsMfa}
            cities={cities}
            cityQuery={cityQuery}
            onCityQuery={setCityQuery}
            departments={departments}
            cityFixed={cityFixed}
            fieldErrors={fieldErrors}
            roleRef={roleRef}
          />
          {error && (
            <div role="alert">
              <FieldError>{error}</FieldError>
            </div>
          )}
        </>
      )}
    </ResponsiveDialog>
  );
}

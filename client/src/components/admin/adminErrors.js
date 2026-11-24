import { t } from "@/i18n/t";

// Copy for a failed admin write, shown inside the dialog (role="alert"). `kind` is "role" or "status".
// The server's own text is never shown: every code maps to our wording (docs 10.2 "Errors").
export function adminErrorMessage(error, kind) {
  if (error.code === "FORBIDDEN")
    return t(kind === "role" ? "admin.role.forbidden" : "admin.status.forbidden");
  if (error.code === "AUTH_PROVIDER_UNAVAILABLE") return t("errors.auth.providerUnavailableAdmin");
  return error.message;
}

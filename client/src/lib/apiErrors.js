import { SUPPORT_CONTACT } from "@/lib/authConfig";
import { t } from "@/i18n/t";

// One place that turns a server error code into a copy key (docs/phase-1-auth.md §8.4, §10.4).
// Screens show `error.message`, which is built here, so no screen ever shows raw server text for a
// code we know. Codes that are not listed keep the server's own message (e.g. OUTSIDE_PINCODE).
const KEYS = {
  UNAUTHENTICATED: "errors.auth.unauthenticated",
  TOKEN_CLAIMS_MISSING: "errors.auth.tokenClaimsMissing",
  EMAIL_NOT_VERIFIED: "errors.auth.emailNotVerified",
  FORBIDDEN: "errors.auth.forbidden",
  SUSPENDED: "errors.auth.suspended",
  MFA_REQUIRED: "errors.auth.mfaRequired",
  NOT_FOUND: "errors.common.notFound",
  VALIDATION_ERROR: "errors.common.validation",
  CONFLICT: "errors.common.conflict",
  ALREADY_VERIFIED: "errors.auth.alreadyVerified",
  AUTH_PROVIDER_UNAVAILABLE: "errors.auth.providerUnavailable",
  AUTH_NOT_CONFIGURED: "errors.auth.providerUnavailable",
};

// Where an unknown code ends up: our own generic line, never the server's text.

/**
 * Copy for an error. Every code of docs/phase-1-auth.md 8.4 has its own line. Anything else gets
 * a generic line: the server's own text is never shown (it stays on error.serverMessage for logs).
 * RATE_LIMITED depends on Retry-After: a wait of a minute or more is shown in minutes.
 */
export function messageForError({ code, status, retryAfter }) {
  const known = messageForCode(code, { retryAfter });
  if (known) return known;
  return t(status >= 500 ? "errors.common.server" : "errors.common.unknown");
}

// The mapped copy for a code, or null when the code is not one we map.
export function messageForCode(code, { retryAfter } = {}) {
  if (code === "RATE_LIMITED") {
    return retryAfter >= 60
      ? t("errors.auth.rateLimited", { minutes: Math.ceil(retryAfter / 60) })
      : t("errors.auth.rateLimitedGeneric");
  }
  const key = KEYS[code];
  return key ? t(key, { contact: SUPPORT_CONTACT }) : null;
}

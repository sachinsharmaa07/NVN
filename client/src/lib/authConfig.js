// Auth0 settings from client/.env (public values, safe in the browser). All three are needed:
// with any missing, authConfig is null and the app runs without sign-in instead of crashing.
const {
  VITE_AUTH0_DOMAIN: domain,
  VITE_AUTH0_CLIENT_ID: clientId,
  VITE_AUTH0_AUDIENCE: audience,
  VITE_SUPPORT_CONTACT: supportContact,
} = import.meta.env;

export const authConfig = domain && clientId && audience ? { domain, clientId, audience } : null;

// Auth0 connection names the sign-in sheet asks for: Google, and passwordless email (6-digit code).
export const GOOGLE_CONNECTION = "google-oauth2";
export const EMAIL_CONNECTION = "email";

// Who a suspended user or a blocked person should contact ({contact} in the copy). One constant,
// until the real support contact is decided (open question Q9).
export const SUPPORT_CONTACT = supportContact || "your city admin";

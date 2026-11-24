// Auth0 settings from client/.env (public values, safe in the browser). All three are needed:
// with any missing, authConfig is null and the app runs without sign-in instead of crashing.
const {
  VITE_AUTH0_DOMAIN: domain,
  VITE_AUTH0_CLIENT_ID: clientId,
  VITE_AUTH0_AUDIENCE: audience,
  VITE_AUTH0_DB_CONNECTION: dbConnection,
  VITE_SUPPORT_CONTACT: supportContact,
} = import.meta.env;

export const authConfig = domain && clientId && audience ? { domain, clientId, audience } : null;

// Auth0 connection names the sign-in sheet asks for. The database one is Auth0's default name;
// set VITE_AUTH0_DB_CONNECTION if your tenant renamed it.
export const GOOGLE_CONNECTION = "google-oauth2";
export const EMAIL_CONNECTION = dbConnection || "Username-Password-Authentication";

// Who a suspended user or a blocked person should contact ({contact} in the copy). One constant,
// until the real support contact is decided (open question Q9).
export const SUPPORT_CONTACT = supportContact || "your city admin";

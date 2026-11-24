// Auth0 settings from client/.env (public values, safe in the browser). All three are needed:
// with any missing, authConfig is null and the app runs without sign-in instead of crashing.
const {
  VITE_AUTH0_DOMAIN: domain,
  VITE_AUTH0_CLIENT_ID: clientId,
  VITE_AUTH0_AUDIENCE: audience,
} = import.meta.env;

export const authConfig = domain && clientId && audience ? { domain, clientId, audience } : null;

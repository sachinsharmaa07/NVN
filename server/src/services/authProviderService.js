// The only door to Auth0's Management API for the rest of the server (tests mock this module).
// `ctx` is optional: { log: req.log, userId } so every line carries the request id.
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { createManagementClient, AuthProviderError } from "./auth0ManagementClient.js";

export { AuthProviderError };

let client; // built on first use, so the server starts without M2M keys
const getClient = () =>
  (client ??= createManagementClient({
    domain: config.AUTH0_DOMAIN,
    clientId: config.AUTH0_M2M_CLIENT_ID,
    clientSecret: config.AUTH0_M2M_CLIENT_SECRET,
    logger,
  }));

const assertAuth0Id = (auth0Id) => {
  // The id comes from our own database record, never from a request body; still refuse junk.
  if (typeof auth0Id !== "string" || auth0Id.length === 0 || auth0Id.length > 128) {
    throw new TypeError("auth0Id must be a non-empty string of at most 128 characters");
  }
};

/** Sets app_metadata.mfa_required in Auth0 (the post-login Action enrols and challenges on it). Idempotent. */
export async function setMfaRequired(auth0Id, flag, ctx = {}) {
  assertAuth0Id(auth0Id);
  if (typeof flag !== "boolean") throw new TypeError("flag must be a boolean");
  await getClient().request({
    op: "setMfaRequired",
    method: "PATCH",
    path: `/api/v2/users/${encodeURIComponent(auth0Id)}`,
    pathTemplate: "/api/v2/users/{id}",
    body: { app_metadata: { mfa_required: flag } },
    retry: "idempotent",
    okStatus: [200],
    log: ctx.log ?? logger,
    userId: ctx.userId,
  });
}

// Step 1 of every protected route: prove who is calling. Verifies the Auth0 access token.
import { auth } from "express-oauth2-jwt-bearer";
import { config } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

// express-oauth2-jwt-bearer wraps EVERY verification failure (including "could not download the
// keys") in a 401-style InvalidTokenError, so a key-server outage is told apart by its message.
// "no applicable key found in the JSON Web Key Set" is the caller's bad kid, so it is NOT here.
const JWKS_OUTAGE_RE =
  /Expected 200 OK from the JSON Web Key Set|fetch failed|timed out|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket hang up|Failed to fetch .*responded with|Failed to parse the response from|Failed to parse the JSON Web Key Set|Failed to fetch authorization server metadata/i;

/** A short, non-sensitive label for the log. The raw library message is never logged or sent. */
function reasonClass(message = "") {
  if (!message) return "missing";
  if (/"exp" claim|expired/i.test(message)) return "expired";
  if (/"nbf" claim/i.test(message)) return "not_yet_valid";
  if (/aud/i.test(message)) return "audience";
  if (/iss/i.test(message)) return "issuer";
  if (/signature|no applicable key/i.test(message)) return "signature";
  if (/alg/i.test(message)) return "algorithm";
  return "invalid";
}

/**
 * Builds the token check. Pure settings in, middleware out, so tests can point it at a local key server.
 * Only RS256 is accepted, and audience, issuer and clock tolerance are explicit.
 */
export function createJwtCheck({ audience, issuer, jwksUri, clockTolerance = 5 }) {
  const check = auth({ audience, issuer, jwksUri, tokenSigningAlg: "RS256", clockTolerance });
  return (req, res, next) =>
    check(req, res, (err) => {
      if (!err) return next();
      if (JWKS_OUTAGE_RE.test(err.message ?? "")) {
        // Fail closed but tell the client it is our side: 503, so it keeps its session and retries.
        req.log?.error({ event: "auth.jwks_error", err: err.message }, "Key server unreachable");
        res.set("Retry-After", "30");
        return next(
          new AppError("AUTH_PROVIDER_UNAVAILABLE", 503, "Sign-in is temporarily unavailable."),
        );
      }
      if (err.status === 400 || err.status === 401 || err.status === 403) {
        // One generic 401 for every token problem. The reason class is logged, never sent:
        // detail would help an attacker tune a forged token.
        req.log?.info(
          { event: "auth.rejected", reason: reasonClass(err.message), ip: req.ip },
          "Token rejected",
        );
        res.set("WWW-Authenticate", "Bearer");
        return next(new AppError("UNAUTHENTICATED", 401, "Sign in to continue."));
      }
      return next(err); // anything else is a real server problem
    });
}

let jwtCheck; // built on first use, so the server can start before Auth0 is set up

export function authenticate(req, res, next) {
  if (!config.AUTH0_DOMAIN || !config.AUTH0_AUDIENCE) {
    return next(
      new AppError("AUTH_NOT_CONFIGURED", 503, "Sign-in is not set up on this server yet."),
    );
  }
  jwtCheck ??= createJwtCheck({
    audience: config.AUTH0_AUDIENCE,
    issuer: `https://${config.AUTH0_DOMAIN}/`,
    jwksUri: `https://${config.AUTH0_DOMAIN}/.well-known/jwks.json`,
    clockTolerance: config.AUTH_CLOCK_TOLERANCE_SECONDS,
  });
  return jwtCheck(req, res, next);
}

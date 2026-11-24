// Step 1 of every protected route: prove who is calling. Verifies the Auth0 access token.
import { auth } from "express-oauth2-jwt-bearer";
import { config } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

/**
 * Builds the token check. Pure settings in, middleware out, so tests can point it at a local key server.
 * Only RS256 is accepted, and the audience and issuer must match exactly; anything else is rejected.
 */
export function createJwtCheck({ audience, issuer, jwksUri }) {
  const check = auth({ audience, issuer, jwksUri, tokenSigningAlg: "RS256" });
  return (req, res, next) =>
    check(req, res, (err) => {
      if (!err) return next();
      // The library's own errors (missing, malformed, expired, wrong audience...) all become one 401.
      // The reason is logged, not sent: it would help an attacker tune a forged token.
      if (err.status === 400 || err.status === 401 || err.status === 403) {
        req.log?.debug({ event: "auth.rejected", reason: err.message }, "Token rejected");
        res.set("WWW-Authenticate", "Bearer");
        return next(new AppError("UNAUTHENTICATED", 401, "Sign in to continue."));
      }
      return next(err); // e.g. the key server was unreachable: a real server problem, not the caller's
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
  });
  return jwtCheck(req, res, next);
}

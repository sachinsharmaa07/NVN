// A stand-in for Auth0 in tests: a real RSA key pair, a tiny key server (JWKS) and a token signer.
// The server code verifies tokens exactly as in production; only the key server's address differs.
import crypto from "node:crypto";
import http from "node:http";

export const ISSUER = "https://tenant.test/";
export const AUDIENCE = "https://api.nivaran.test";
const KID = "test-key-1";

const b64url = (input) => Buffer.from(input).toString("base64url");
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

/** Starts the key server on a free port. Returns { jwksUri, close }. */
export async function startKeyServer() {
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    jwksUri: `http://127.0.0.1:${port}/.well-known/jwks.json`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export const NS = "https://nivaran.in/";
const SIGNED_CLAIMS = ["email", "email_verified", "name", "picture", "mfa"];
const CLAIM_DEFAULTS = { email: "asha@example.com", email_verified: true, name: "Asha" };

/**
 * Signs a token the way our Auth0 Action would. `opts` (all optional):
 *   sub, aud, iss, exp, iat  registered claims (defaults: auth0|user-1, our audience and issuer, +1 hour)
 *   email, email_verified, name, picture, mfa   custom claims under NS; `null` leaves the claim out
 *   kid                      key id in the header (default: the key the key server publishes)
 *   anything else            copied into the payload as is (e.g. a forged `role`)
 * `header` and `key` let a test forge a bad token: another algorithm, or another key.
 */
export function signToken(opts = {}, { header = {}, key = privateKey } = {}) {
  const { sub, aud, iss, exp, iat, kid, ...rest } = opts;
  const now = Math.floor(Date.now() / 1000);
  const head = { alg: "RS256", typ: "JWT", kid: kid ?? KID, ...header };
  const body = {
    iss: iss ?? ISSUER,
    aud: aud ?? AUDIENCE,
    sub: sub ?? "auth0|user-1",
    iat: iat ?? now,
    exp: exp ?? now + 3600,
  };
  for (const name of SIGNED_CLAIMS) {
    const value = name in rest ? rest[name] : CLAIM_DEFAULTS[name];
    if (value !== undefined && value !== null) body[`${NS}${name}`] = value;
    delete rest[name];
  }
  Object.assign(body, rest);
  const data = `${b64url(JSON.stringify(head))}.${b64url(JSON.stringify(body))}`;
  if (head.alg === "none") return `${data}.`;
  const signature =
    head.alg === "RS256"
      ? crypto.sign("RSA-SHA256", Buffer.from(data), key)
      : crypto.createHmac("sha256", "any-secret").update(data).digest(); // HS256 forgery
  return `${data}.${signature.toString("base64url")}`;
}

/** A token signed by a different key pair but claiming the same key id. */
export function signWithWrongKey(payload = {}) {
  const { privateKey: other } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  return signToken(payload, { key: other });
}

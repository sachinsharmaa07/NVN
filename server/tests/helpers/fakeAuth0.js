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

/**
 * Signs a token. `payload` overrides the defaults (a valid token for user-1, expires in an hour).
 * `header` and `key` let a test forge a bad one: another algorithm, or another key.
 */
export function signToken(payload = {}, { header = {}, key = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = { alg: "RS256", typ: "JWT", kid: KID, ...header };
  const body = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: "auth0|user-1",
    iat: now,
    exp: now + 3600,
    ...payload,
  };
  const data = `${b64url(JSON.stringify(head))}.${b64url(JSON.stringify(body))}`;
  if (head.alg === "none") return `${data}.`;
  const signature =
    head.alg === "RS256"
      ? crypto.sign("RSA-SHA256", Buffer.from(data), key)
      : crypto.createHmac("sha256", "any-secret").update(data).digest(); // HS256 forgery
  return `${data}.${signature.toString("base64url")}`;
}

/** A token signed by a different key pair but claiming the same key id. */
export function signWithWrongKey(payload) {
  const { privateKey: other } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  return signToken(payload, { key: other });
}

export const NS = "https://nivaran.in/";
/** The custom claims our Auth0 Action adds. */
export const claims = (extra = {}) => ({
  [`${NS}email`]: "asha@example.com",
  [`${NS}name`]: "Asha",
  [`${NS}email_verified`]: true,
  ...extra,
});

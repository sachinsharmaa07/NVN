// Minimal Auth0 Management API client on Node's fetch (no SDK). Everything that can go wrong is
// turned into a typed AuthProviderError (503); secrets, tokens and bodies are never logged or sent on.
// Design: docs/phase-1-auth.md section 8.1. Pure and injectable: authProviderService wires the config.
import { AppError } from "../utils/AppError.js";
import { createBreaker } from "../utils/circuitBreaker.js";

// Timeouts in ms: token fetch, one API call, and the whole operation including retries.
export const TIMEOUTS = Object.freeze({ token: 3000, call: 5000, total: 8000 });
const MAX_RETRY_AFTER_MS = 2000;

/**
 * Auth0 could not be used. `kind`: timeout | network | upstream | rate_limited | breaker_open |
 * misconfigured (Auth0 said 401/403/unexpected 4xx: our credentials or scopes are wrong).
 * All map to 503 AUTH_PROVIDER_UNAVAILABLE for the caller; `kind` is for logs and tests.
 */
export class AuthProviderError extends AppError {
  constructor(kind, cause) {
    super(
      "AUTH_PROVIDER_UNAVAILABLE",
      503,
      "We couldn't reach the sign-in service. Try again in a minute.",
    );
    this.name = "AuthProviderError";
    this.kind = kind;
    this.retryAfterSeconds = 30; // for a Retry-After header
    if (cause) this.cause = cause;
  }
}

const isTimeout = (e) => e?.name === "TimeoutError" || e?.name === "AbortError";

/** Auth0's own short error code (e.g. "inconsistent_state"), only if it looks like a code. */
async function readErrorCode(res) {
  try {
    const body = await res.json();
    const code = body?.errorCode ?? body?.error;
    return typeof code === "string" && /^[\w.-]{1,64}$/.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

export function createManagementClient({
  domain,
  clientId,
  clientSecret,
  logger,
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
  breaker = createBreaker({ now }),
}) {
  const base = `https://${domain}`;
  let cached = null; // { value, expiresAt }
  let inflight = null; // one shared token request, so a burst does not fetch many tokens

  const timedFetch = (url, init, ms) =>
    fetchImpl(url, { ...init, signal: AbortSignal.timeout(ms) });

  async function fetchToken(budgetMs) {
    let res;
    try {
      res = await timedFetch(
        `${base}/oauth/token`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            audience: `${base}/api/v2/`,
          }),
        },
        Math.min(TIMEOUTS.token, budgetMs),
      );
    } catch (e) {
      throw new AuthProviderError(isTimeout(e) ? "timeout" : "network", e);
    }
    if (res.status === 429 || res.status >= 500) throw new AuthProviderError("upstream");
    if (!res.ok) throw new AuthProviderError("misconfigured"); // wrong id or secret
    const data = await res.json().catch(() => null);
    if (typeof data?.access_token !== "string" || !(data.expires_in > 0)) {
      throw new AuthProviderError("upstream");
    }
    // Refresh at 90% of the lifetime, but never closer than 60 s to expiry.
    const e = data.expires_in;
    const ttl = e > 60 ? Math.min(0.9 * e, e - 60) : 0.9 * e;
    return { value: data.access_token, expiresAt: now() + ttl * 1000 };
  }

  function getToken(budgetMs) {
    if (cached && cached.expiresAt > now()) return Promise.resolve(cached.value);
    inflight ??= fetchToken(budgetMs)
      .then((t) => {
        cached = t;
        return t.value;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  /**
   * Runs one Management API operation.
   * @param {object} o
   * @param {string} o.op          name for logs, e.g. "setMfaRequired"
   * @param {string} o.method      HTTP method
   * @param {string} o.path        real path (may hold an encoded user id)
   * @param {string} o.pathTemplate path for logs, e.g. "/api/v2/users/{id}" (no ids)
   * @param {object} [o.body]      JSON body (never logged)
   * @param {"idempotent"|"limited"} o.retry idempotent: retry 5xx, network, timeout. limited: only 429, 502, 503
   * @param {number[]} o.okStatus  statuses that mean success
   */
  async function request({
    op,
    method,
    path,
    pathTemplate,
    body,
    retry,
    okStatus,
    log = logger,
    userId,
  }) {
    if (!clientId || !clientSecret || !domain) {
      throw new AppError(
        "AUTH_NOT_CONFIGURED",
        503,
        "Sign-in management is not set up on this server yet.",
      );
    }
    if (!breaker.acquire()) throw new AuthProviderError("breaker_open");

    const start = now();
    const deadline = start + TIMEOUTS.total;
    const left = () => deadline - now();
    let attempt = 0;
    let refreshed = false;
    let rateRetries = 0;
    let errRetries = 0;
    let status;
    let code;
    // Never includes the secret, the token, headers or any body.
    const fields = () => ({
      op,
      method,
      path: pathTemplate,
      status,
      attempt,
      userId,
      auth0ErrorCode: code,
      durationMs: now() - start,
      breaker: breaker.state(),
    });
    const backoff = () =>
      sleep(Math.min(Math.max(0, left()), (errRetries === 1 ? 200 : 600) * (0.5 + random())));

    try {
      for (;;) {
        attempt += 1;
        if (left() <= 0) throw new AuthProviderError("timeout");
        const token = await getToken(left());
        let res;
        try {
          res = await timedFetch(
            `${base}${path}`,
            {
              method,
              headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
              body: body === undefined ? undefined : JSON.stringify(body),
            },
            Math.min(TIMEOUTS.call, left()),
          );
        } catch (e) {
          // A timeout may or may not have reached Auth0: only idempotent calls are retried.
          if (retry === "idempotent" && errRetries < 2) {
            errRetries += 1;
            await backoff();
            continue;
          }
          throw new AuthProviderError(isTimeout(e) ? "timeout" : "network", e);
        }
        status = res.status;
        if (okStatus.includes(status)) {
          await res.arrayBuffer().catch(() => {}); // release the connection; the body is unused
          breaker.success();
          log.debug({ event: "auth0.mgmt.call", ...fields() }, "Management API call ok");
          return { status };
        }
        code = await readErrorCode(res);
        if (status === 401 && !refreshed) {
          // The cached token was revoked or expired early: drop it, fetch one fresh, retry once.
          refreshed = true;
          if (cached?.value === token) cached = null;
          continue;
        }
        if (status === 429) {
          if (rateRetries >= 2) throw new AuthProviderError("rate_limited");
          rateRetries += 1;
          const header = Number(res.headers?.get?.("retry-after"));
          const wait = Number.isFinite(header) && header >= 0 ? header * 1000 : 1000;
          await sleep(Math.min(wait, MAX_RETRY_AFTER_MS, Math.max(0, left())));
          continue;
        }
        if (status >= 500) {
          const retryable = retry === "idempotent" || status === 502 || status === 503;
          if (retryable && errRetries < 2) {
            errRetries += 1;
            await backoff();
            continue;
          }
          throw new AuthProviderError("upstream");
        }
        throw new AuthProviderError("misconfigured"); // 401 after refresh, 403, any other 4xx
      }
    } catch (err) {
      if (err instanceof AuthProviderError && err.kind === "misconfigured") {
        breaker.success(); // Auth0 answered, so it is reachable; 4xx does not open the breaker
        log.error({ event: "auth0.mgmt.misconfigured", ...fields() }, "Management API refused us");
      } else {
        breaker.failure();
        log.error(
          { event: "mgmt.api_error", kind: err.kind, ...fields() },
          "Management API failed",
        );
      }
      throw err;
    }
  }

  return { request, breakerState: breaker.state };
}

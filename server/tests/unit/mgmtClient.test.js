import { describe, it, expect, vi } from "vitest";
import {
  createManagementClient,
  AuthProviderError,
  TIMEOUTS,
} from "../../src/services/auth0ManagementClient.js";
import { createBreaker } from "../../src/utils/circuitBreaker.js";
import { AppError } from "../../src/utils/AppError.js";

const SECRET = "s3cret-value-xyz";
const M2M_TOKEN = "m2m-token-abc";
const json = (status, body = {}, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const tokenOk = (expires_in = 86400, access_token = M2M_TOKEN) =>
  json(200, { access_token, expires_in });
const timeoutError = () =>
  Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

/**
 * A client wired to a scripted fetch. `script(url, init, n)` returns a Response (or throws);
 * time is a variable the test moves, sleeps are recorded instead of waited.
 */
function setup(script, over = {}) {
  const t = { ms: 1_000_000 };
  const calls = [];
  const sleeps = [];
  const logs = [];
  const sink = (level) => (obj, msg) => logs.push({ level, obj, msg });
  const logger = {
    debug: sink("debug"),
    info: sink("info"),
    warn: sink("warn"),
    error: sink("error"),
  };
  const fetchImpl = vi.fn(async (url, init) => {
    calls.push({ url, init });
    return script(url, init, calls.length, t);
  });
  const client = createManagementClient({
    domain: "t.test",
    clientId: "cid",
    clientSecret: SECRET,
    logger,
    fetchImpl,
    now: () => t.ms,
    sleep: async (ms) => {
      sleeps.push(ms);
      t.ms += ms;
    },
    random: () => 0.5,
    ...over,
  });
  return { client, t, calls, sleeps, logs, fetchImpl };
}
const patch = (client, extra = {}) =>
  client.request({
    op: "setMfaRequired",
    method: "PATCH",
    path: "/api/v2/users/auth0%7C1",
    pathTemplate: "/api/v2/users/{id}",
    body: { app_metadata: { mfa_required: true } },
    retry: "idempotent",
    okStatus: [200],
    ...extra,
  });
const isToken = (url) => url.endsWith("/oauth/token");
const failsWith = async (promise, kind) => {
  const err = await promise.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(AuthProviderError);
  expect(err).toBeInstanceOf(AppError);
  expect(err.status).toBe(503);
  expect(err.code).toBe("AUTH_PROVIDER_UNAVAILABLE");
  expect(err.kind).toBe(kind);
  return err;
};

describe("token handling", () => {
  it("fetches a token, caches it and sends it as a Bearer header", async () => {
    const { client, calls } = setup((url) => (isToken(url) ? tokenOk() : json(200)));
    await patch(client);
    await patch(client);
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(1);
    const api = calls.filter((c) => !isToken(c.url));
    expect(api).toHaveLength(2);
    expect(api[0].init.headers.authorization).toBe(`Bearer ${M2M_TOKEN}`);
    expect(api[0].url).toBe("https://t.test/api/v2/users/auth0%7C1");
    expect(JSON.parse(calls[0].init.body)).toMatchObject({
      grant_type: "client_credentials",
      audience: "https://t.test/api/v2/",
    });
  });

  it("shares one in-flight token request between concurrent callers", async () => {
    const { client, calls } = setup(async (url) => {
      if (isToken(url)) await new Promise((r) => setTimeout(r, 20));
      return isToken(url) ? tokenOk() : json(200);
    });
    await Promise.all([patch(client), patch(client), patch(client)]);
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(1);
  });

  it("refreshes at 90% of the lifetime, never closer than 60 s to expiry", async () => {
    const { client, calls, t } = setup((url) => (isToken(url) ? tokenOk(1000) : json(200)));
    await patch(client);
    t.ms += 899_000; // 89.9% of 1000 s: still cached
    await patch(client);
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(1);
    t.ms += 2_000; // past 90%
    await patch(client);
    expect(calls.filter((c) => isToken(c.url))).toHaveLength(2);
  });

  it("on a 401 drops the token, fetches a new one and retries once", async () => {
    let apiCalls = 0;
    let tokens = 0;
    const { client, calls } = setup((url, init) => {
      if (isToken(url)) return tokenOk(86400, `tok-${++tokens}`);
      apiCalls += 1;
      return init.headers.authorization === "Bearer tok-1" ? json(401) : json(200);
    });
    await patch(client);
    expect(tokens).toBe(2);
    expect(apiCalls).toBe(2);
    expect(calls.at(-1).init.headers.authorization).toBe("Bearer tok-2");
  });

  it("a second 401 is a misconfiguration, not a loop", async () => {
    const { client, calls } = setup((url) => (isToken(url) ? tokenOk() : json(401)));
    await failsWith(patch(client), "misconfigured");
    expect(calls.filter((c) => !isToken(c.url))).toHaveLength(2);
  });

  it("bad M2M credentials (token endpoint 401/403) are a misconfiguration", async () => {
    const { client } = setup(() => json(401, { error: "access_denied" }));
    await failsWith(patch(client), "misconfigured");
  });
});

describe("retries", () => {
  it("retries an idempotent PATCH on 5xx and succeeds", async () => {
    let n = 0;
    const { client, sleeps } = setup((url) =>
      isToken(url) ? tokenOk() : ++n < 3 ? json(500) : json(200),
    );
    await expect(patch(client)).resolves.toEqual({ status: 200 });
    expect(n).toBe(3);
    expect(sleeps).toEqual([200, 600]); // jittered with random()=0.5 -> factor 1
  });

  it("gives up after two retries on persistent 5xx", async () => {
    let n = 0;
    const { client } = setup((url) => (isToken(url) ? tokenOk() : (n++, json(500))));
    await failsWith(patch(client), "upstream");
    expect(n).toBe(3);
  });

  it("retries a network error on an idempotent call", async () => {
    let n = 0;
    const { client } = setup((url) => {
      if (isToken(url)) return tokenOk();
      if (++n === 1) throw new TypeError("fetch failed");
      return json(200);
    });
    await patch(client);
    expect(n).toBe(2);
  });

  it("the email job ('limited') retries 502 and 503 but not 500 or a timeout", async () => {
    const job = (client) =>
      client.request({
        op: "resend",
        method: "POST",
        path: "/api/v2/jobs/verification-email",
        pathTemplate: "/api/v2/jobs/verification-email",
        body: { user_id: "auth0|1" },
        retry: "limited",
        okStatus: [201],
      });

    let n = 0;
    const a = setup((url) => (isToken(url) ? tokenOk() : ++n === 1 ? json(503) : json(201)));
    await expect(job(a.client)).resolves.toEqual({ status: 201 });
    expect(n).toBe(2);

    let m = 0;
    const b = setup((url) => (isToken(url) ? tokenOk() : (m++, json(500))));
    await failsWith(job(b.client), "upstream");
    expect(m).toBe(1);

    let k = 0;
    const c = setup((url) => {
      if (isToken(url)) return tokenOk();
      k++;
      throw timeoutError();
    });
    await failsWith(job(c.client), "timeout");
    expect(k).toBe(1); // might have been sent: never repeat
  });

  it("waits Retry-After on 429 (capped at 2 s) and retries at most twice", async () => {
    let n = 0;
    const { client, sleeps } = setup((url) =>
      isToken(url) ? tokenOk() : (n++, json(429, {}, { "retry-after": "60" })),
    );
    await failsWith(patch(client), "rate_limited");
    expect(n).toBe(3);
    expect(sleeps).toEqual([2000, 2000]);
  });

  it("recovers when a 429 clears", async () => {
    let n = 0;
    const { client, sleeps } = setup((url) =>
      isToken(url) ? tokenOk() : ++n === 1 ? json(429, {}, { "retry-after": "1" }) : json(200),
    );
    await patch(client);
    expect(sleeps).toEqual([1000]);
  });

  it("does not retry other 4xx", async () => {
    let n = 0;
    const { client } = setup((url) =>
      isToken(url) ? tokenOk() : (n++, json(400, { errorCode: "invalid_body" })),
    );
    await failsWith(patch(client), "misconfigured");
    expect(n).toBe(1);
  });
});

describe("timeouts", () => {
  it("a call timeout becomes kind 'timeout'", async () => {
    const { client } = setup((url) => {
      if (isToken(url)) return tokenOk();
      throw timeoutError();
    });
    await failsWith(patch(client, { retry: "limited" }), "timeout");
  });

  it("a token timeout becomes kind 'timeout'", async () => {
    const { client } = setup(() => {
      throw timeoutError();
    });
    await failsWith(patch(client), "timeout");
  });

  it("passes an abort signal and never exceeds the per-call timeout", async () => {
    const { client, fetchImpl } = setup((url) => (isToken(url) ? tokenOk() : json(200)));
    await patch(client);
    for (const [, init] of fetchImpl.mock.calls) expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(TIMEOUTS).toEqual({ token: 3000, call: 5000, total: 8000 });
  });

  it("stops retrying once the 8 s total budget is spent", async () => {
    let n = 0;
    const { client } = setup((url, init, _i, t) => {
      if (isToken(url)) return tokenOk();
      n++;
      t.ms += 5000; // each attempt burns its full 5 s
      return json(500);
    });
    await failsWith(patch(client), "timeout");
    expect(n).toBeLessThanOrEqual(2);
  });
});

describe("circuit breaker", () => {
  const failing = () => setup((url) => (isToken(url) ? tokenOk() : json(500)));

  it("opens after 5 consecutive failed operations and then fails fast", async () => {
    const { client, calls, t } = failing();
    for (let i = 0; i < 5; i++) await failsWith(patch(client), "upstream");
    const before = calls.length;
    await failsWith(patch(client), "breaker_open");
    expect(calls.length).toBe(before); // no network call at all
    expect(client.breakerState()).toBe("open");
    t.ms += 14_000;
    await failsWith(patch(client), "breaker_open");
  });

  it("lets one probe through after 15 s; success closes it", async () => {
    let healthy = false;
    const { client, t } = setup((url) =>
      isToken(url) ? tokenOk() : healthy ? json(200) : json(500),
    );
    for (let i = 0; i < 5; i++) await failsWith(patch(client), "upstream");
    t.ms += 15_001;
    expect(client.breakerState()).toBe("half_open");
    healthy = true;
    await patch(client);
    expect(client.breakerState()).toBe("closed");
  });

  it("a failed probe re-opens it for another 15 s", async () => {
    const { client, t } = failing();
    for (let i = 0; i < 5; i++) await failsWith(patch(client), "upstream");
    t.ms += 15_001;
    await failsWith(patch(client), "upstream"); // the probe
    await failsWith(patch(client), "breaker_open");
    expect(client.breakerState()).toBe("open");
  });

  it("4xx answers never open it, and a success resets the count", async () => {
    let status = 400;
    const { client } = setup((url) => (isToken(url) ? tokenOk() : json(status)));
    for (let i = 0; i < 8; i++) await failsWith(patch(client), "misconfigured");
    expect(client.breakerState()).toBe("closed");
    status = 500;
    for (let i = 0; i < 4; i++) await failsWith(patch(client), "upstream");
    status = 200;
    await patch(client);
    status = 500;
    for (let i = 0; i < 4; i++) await failsWith(patch(client), "upstream");
    expect(client.breakerState()).toBe("closed"); // 4 + 4, never 5 in a row
  });

  it("createBreaker admits exactly one probe at a time", () => {
    let now = 0;
    const b = createBreaker({ threshold: 1, openMs: 10, now: () => now });
    b.failure();
    expect(b.acquire()).toBe(false);
    now = 11;
    expect(b.acquire()).toBe(true);
    expect(b.acquire()).toBe(false);
  });
});

describe("configuration and redaction", () => {
  it("without keys: AUTH_NOT_CONFIGURED 503 and no network call", async () => {
    const { client, fetchImpl } = setup(() => json(200), {
      clientId: undefined,
      clientSecret: undefined,
    });
    const err = await patch(client).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).not.toBeInstanceOf(AuthProviderError);
    expect([err.code, err.status]).toEqual(["AUTH_NOT_CONFIGURED", 503]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never logs or exposes the secret, the M2M token, headers or bodies", async () => {
    const upstreamBody = {
      errorCode: "inconsistent_state",
      message: `leak ${SECRET} ${M2M_TOKEN}`,
    };
    const { client, logs } = setup((url) => (isToken(url) ? tokenOk() : json(500, upstreamBody)));
    const err = await patch(client, { userId: "u-1" }).catch((e) => e);
    const everything = JSON.stringify({
      logs,
      err: { ...err, message: err.message, stack: err.stack },
    });
    for (const needle of [
      SECRET,
      M2M_TOKEN,
      "Bearer",
      "authorization",
      "leak",
      "mfa_required",
      "client_secret",
    ]) {
      expect(everything).not.toContain(needle);
    }
    // What is logged: the useful, safe fields.
    const failure = logs.find((l) => l.obj.event === "mgmt.api_error");
    expect(failure.level).toBe("error");
    expect(failure.obj).toMatchObject({
      op: "setMfaRequired",
      method: "PATCH",
      path: "/api/v2/users/{id}", // the template, not the id
      status: 500,
      auth0ErrorCode: "inconsistent_state",
      userId: "u-1",
    });
    expect(failure.obj.durationMs).toBeTypeOf("number");
  });

  it("logs a refused call (4xx) as auth0.mgmt.misconfigured at error", async () => {
    const { client, logs } = setup((url) =>
      isToken(url) ? tokenOk() : json(403, { error: "insufficient_scope" }),
    );
    await failsWith(patch(client), "misconfigured");
    expect(
      logs.some((l) => l.obj.event === "auth0.mgmt.misconfigured" && l.level === "error"),
    ).toBe(true);
  });

  it("ignores an Auth0 error 'code' that is not code-shaped (could be free text)", async () => {
    const { client, logs } = setup((url) =>
      isToken(url) ? tokenOk() : json(400, { error: "free text with spaces and secrets" }),
    );
    await failsWith(patch(client), "misconfigured");
    expect(JSON.stringify(logs)).not.toContain("free text");
  });
});

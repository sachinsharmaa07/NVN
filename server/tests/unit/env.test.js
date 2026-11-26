import { describe, it, expect } from "vitest";
import { parseEnv } from "../../src/config/env.js";

const URI = "mongodb://127.0.0.1:27017/nivaran_dev";
const M2M = { AUTH0_M2M_CLIENT_ID: "client-id", AUTH0_M2M_CLIENT_SECRET: "client-secret" };

describe("parseEnv", () => {
  it("applies defaults when only MONGODB_URI is given", () => {
    const result = parseEnv({ MONGODB_URI: URI });
    expect(result.ok).toBe(true);
    expect(result.config).toEqual({
      NODE_ENV: "development",
      PORT: 5001,
      MONGODB_URI: URI,
      CLIENT_URL: "http://localhost:5173",
      LOG_LEVEL: "info",
      TRUST_PROXY: 0,
      AUTH_CLOCK_TOLERANCE_SECONDS: 5,
    });
    expect(Object.isFrozen(result.config)).toBe(true);
  });

  it("names MONGODB_URI when it is missing (or empty) outside tests", () => {
    expect(parseEnv({}).problems).toEqual(["MONGODB_URI: required"]);
    expect(
      parseEnv({
        MONGODB_URI: "",
        NODE_ENV: "production",
        CLIENT_URL: "https://nivaran.in",
        TRUST_PROXY: "1",
        AUTH0_DOMAIN: "nivaran.eu.auth0.com",
        AUTH0_AUDIENCE: "https://api.nivaran.in",
        ...M2M,
      }).problems,
    ).toEqual(["MONGODB_URI: required"]);
  });

  it("does not require MONGODB_URI when NODE_ENV=test", () => {
    expect(parseEnv({ NODE_ENV: "test" }).ok).toBe(true);
  });

  it("names every bad key", () => {
    const result = parseEnv({
      MONGODB_URI: URI,
      PORT: "abc",
      LOG_LEVEL: "loud",
      CLIENT_URL: "not a url",
    });
    expect(result.ok).toBe(false);
    const keys = result.problems.map((p) => p.split(":")[0]).sort();
    expect(keys).toEqual(["CLIENT_URL", "LOG_LEVEL", "PORT"]);
  });

  it("reports a missing MONGODB_URI together with other problems, not one at a time", () => {
    const result = parseEnv({ PORT: "abc" });
    const keys = result.problems.map((p) => p.split(":")[0]).sort();
    expect(keys).toEqual(["MONGODB_URI", "PORT"]);
  });

  it("refuses a test database that could be the real one", () => {
    const same = parseEnv({ MONGODB_URI: URI, MONGODB_URI_TEST: URI });
    expect(same.problems).toEqual(["MONGODB_URI_TEST: must not be the same as MONGODB_URI"]);
    const badName = parseEnv({
      MONGODB_URI: URI,
      MONGODB_URI_TEST: "mongodb+srv://u:p@c.mongodb.net/nivaran_prod?retryWrites=true",
    });
    expect(badName.problems[0]).toMatch(/must end in _test/);
    const good = parseEnv({
      MONGODB_URI: URI,
      MONGODB_URI_TEST: "mongodb+srv://u:p@c.mongodb.net/nivaran_test?retryWrites=true",
    });
    expect(good.ok).toBe(true);
  });

  it("requires CLIENT_URL, TRUST_PROXY and the Auth0 settings in production", () => {
    const keys = parseEnv({ NODE_ENV: "production", MONGODB_URI: URI }).problems.map(
      (p) => p.split(":")[0],
    );
    expect(keys).toEqual([
      "CLIENT_URL",
      "TRUST_PROXY",
      "AUTH0_DOMAIN",
      "AUTH0_AUDIENCE",
      "AUTH0_M2M_CLIENT_ID",
      "AUTH0_M2M_CLIENT_SECRET",
    ]);
  });

  it("rejects TRUST_PROXY=0 in production (one shared rate-limit bucket behind a proxy)", () => {
    const result = parseEnv({
      NODE_ENV: "production",
      MONGODB_URI: URI,
      CLIENT_URL: "https://nivaran.in",
      TRUST_PROXY: "0",
      AUTH0_DOMAIN: "nivaran.eu.auth0.com",
      AUTH0_AUDIENCE: "https://api.nivaran.in",
      ...M2M,
    });
    expect(result.problems).toEqual([expect.stringMatching(/^TRUST_PROXY/)]);
  });

  it("accepts a bare Auth0 host and rejects one with https://", () => {
    expect(parseEnv({ MONGODB_URI: URI, AUTH0_DOMAIN: "nivaran.eu.auth0.com" }).ok).toBe(true);
    const bad = parseEnv({ MONGODB_URI: URI, AUTH0_DOMAIN: "https://nivaran.eu.auth0.com/" });
    expect(bad.ok).toBe(false);
    expect(bad.problems[0]).toMatch(/^AUTH0_DOMAIN/);
  });

  it("reduces CLIENT_URL to its origin so it matches the Origin header", () => {
    expect(
      parseEnv({ MONGODB_URI: URI, CLIENT_URL: "https://nivaran.in/" }).config.CLIENT_URL,
    ).toBe("https://nivaran.in");
  });

  it("keeps the clock tolerance explicit, defaulting to 5 s and refusing more than 30 s", () => {
    expect(parseEnv({ MONGODB_URI: URI }).config.AUTH_CLOCK_TOLERANCE_SECONDS).toBe(5);
    expect(
      parseEnv({ MONGODB_URI: URI, AUTH_CLOCK_TOLERANCE_SECONDS: "10" }).config
        .AUTH_CLOCK_TOLERANCE_SECONDS,
    ).toBe(10);
    const bad = parseEnv({ MONGODB_URI: URI, AUTH_CLOCK_TOLERANCE_SECONDS: "31" });
    expect(bad.problems[0]).toMatch(/^AUTH_CLOCK_TOLERANCE_SECONDS/);
  });

  it("lowercases SUPER_ADMIN_EMAIL and rejects a malformed one", () => {
    const ok = parseEnv({ MONGODB_URI: URI, SUPER_ADMIN_EMAIL: "  Sachin@Example.COM " });
    expect(ok.config.SUPER_ADMIN_EMAIL).toBe("sachin@example.com");
    expect(parseEnv({ MONGODB_URI: URI, SUPER_ADMIN_EMAIL: "nope" }).ok).toBe(false);
  });

  it("outside production the M2M keys are optional but must come as a pair", () => {
    expect(parseEnv({ MONGODB_URI: URI, ...M2M }).ok).toBe(true);
    const half = parseEnv({ MONGODB_URI: URI, AUTH0_M2M_CLIENT_ID: "only-id" });
    expect(half.problems).toEqual([expect.stringMatching(/set both or neither/)]);
  });
});

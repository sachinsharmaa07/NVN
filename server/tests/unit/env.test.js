import { describe, it, expect } from "vitest";
import { parseEnv } from "../../src/config/env.js";

const URI = "mongodb://127.0.0.1:27017/nivaran_dev";

describe("parseEnv", () => {
  it("applies defaults when only MONGODB_URI is given", () => {
    const result = parseEnv({ MONGODB_URI: URI });
    expect(result.ok).toBe(true);
    expect(result.config).toEqual({
      NODE_ENV: "development",
      PORT: 5000,
      MONGODB_URI: URI,
      CLIENT_URL: "http://localhost:5173",
      LOG_LEVEL: "info",
      TRUST_PROXY: 0,
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
    expect(keys).toEqual(["CLIENT_URL", "TRUST_PROXY", "AUTH0_DOMAIN", "AUTH0_AUDIENCE"]);
  });

  it("rejects TRUST_PROXY=0 in production (one shared rate-limit bucket behind a proxy)", () => {
    const result = parseEnv({
      NODE_ENV: "production",
      MONGODB_URI: URI,
      CLIENT_URL: "https://nivaran.in",
      TRUST_PROXY: "0",
      AUTH0_DOMAIN: "nivaran.eu.auth0.com",
      AUTH0_AUDIENCE: "https://api.nivaran.in",
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
});

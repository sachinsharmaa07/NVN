// The one seam in the auth path: where the token check gets its signing keys.
// In production `authenticate` fetches keys from https://<tenant>/.well-known/jwks.json. In tests the
// SAME check (createJwtCheck: audience, issuer, RS256, clock tolerance) is pointed at a local key
// server. Everything after it (loadUser, guards, services, MongoDB) is the real code.
//
// In each API test file:
//   vi.mock("../../src/middleware/auth.js", async (orig) =>
//     (await import("../helpers/authSeam.js")).authModule(await orig()));
//   useFakeAuth0();
import { beforeAll, afterAll } from "vitest";
import { AUDIENCE, ISSUER, startKeyServer } from "./fakeAuth0.js";

const seam = { check: null };

/** The replacement for the auth module: same exports, `authenticate` uses the local key server. */
export function authModule(actual) {
  return {
    ...actual,
    authenticate: (req, res, next) => {
      if (!seam.check) throw new Error("useFakeAuth0() was not called in this test file");
      return seam.check(req, res, next);
    },
  };
}

export function useFakeAuth0() {
  let keys;
  beforeAll(async () => {
    const { createJwtCheck } = await import("../../src/middleware/auth.js");
    keys = await startKeyServer();
    seam.check = createJwtCheck({ audience: AUDIENCE, issuer: ISSUER, jwksUri: keys.jwksUri });
  });
  afterAll(async () => {
    seam.check = null;
    await keys?.close();
  });
}

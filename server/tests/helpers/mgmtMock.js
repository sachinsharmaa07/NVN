// The Auth0 Management API is the only thing the API tests replace. We swap the HTTP client
// (services/auth0ManagementClient.js `createManagementClient`) for one whose `request` is a spy; the
// real authProviderService still builds the real calls, so the arguments asserted here are exactly
// what would go to Auth0. AuthProviderError stays the real class (the 503 mapping is real).
//
// In each API test file:
//   vi.mock("../../src/services/auth0ManagementClient.js", async (orig) =>
//     (await import("../helpers/mgmtMock.js")).clientModule(await orig()));
import { vi } from "vitest";

export const request = vi.fn(async () => ({}));

export function clientModule(actual) {
  return { ...actual, createManagementClient: () => ({ request }) };
}

export const resetMgmt = () => {
  request.mockReset();
  request.mockImplementation(async () => ({}));
};

/** Every setMfaRequired call so far, as { auth0Id, flag }. */
export const mfaCalls = () =>
  request.mock.calls
    .map(([arg]) => arg)
    .filter((arg) => arg.op === "setMfaRequired")
    .map((arg) => ({
      auth0Id: decodeURIComponent(arg.path.split("/").pop()),
      flag: arg.body.app_metadata.mfa_required,
    }));

/** Make the next call fail the way an outage does. `kind`: timeout | network | upstream | ... */
export async function failNext(kind = "upstream", times = 1) {
  const { AuthProviderError } = await import("../../src/services/auth0ManagementClient.js");
  for (let i = 0; i < times; i++) request.mockRejectedValueOnce(new AuthProviderError(kind));
}

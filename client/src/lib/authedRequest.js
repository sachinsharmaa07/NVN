import { ApiError, request } from "@/lib/api";
import { messageForCode } from "@/lib/apiErrors";

/*
 * One API call with the user's access token attached, used by useApi and by the /api/me query.
 *
 * getAuthHeaders(options) comes from AuthProvider and returns { Authorization: "Bearer ..." }.
 * Flow:
 *   1. Ask Auth0 for a token (from memory, or silently from a refresh token) and call the API.
 *   2. If the API answers 401, the token may simply have expired a moment ago. Ask Auth0 for a
 *      brand-new one (cacheMode "off" skips its memory cache) and try exactly ONE more time.
 *   3. If that fails too, the session is really over: throw the 401 so the caller can show the
 *      "session ended" sign-in sheet. No loops, no endless refreshing.
 */
export async function authedRequest(getAuthHeaders, path, options = {}) {
  const attempt = async (tokenOptions) => {
    let headers;
    try {
      headers = await getAuthHeaders(tokenOptions);
    } catch (cause) {
      // Auth0 could not give us a token (refresh token expired or revoked): same as a 401.
      throw Object.assign(
        new ApiError({
          code: "UNAUTHENTICATED",
          message: messageForCode("UNAUTHENTICATED"),
          status: 401,
        }),
        { cause },
      );
    }
    return request(path, { ...options, headers: { ...headers, ...options.headers } });
  };

  try {
    return await attempt();
  } catch (error) {
    // A 401 for a missing email claim is not an expired token: a new token would not help.
    if (error.status !== 401 || error.code === "TOKEN_CLAIMS_MISSING") throw error;
    return attempt({ cacheMode: "off" });
  }
}

import { createContext } from "react";

/*
 * What every component can read about the signed-in user (via useAuth). AuthProvider writes it.
 *   status: "unconfigured" | "loading" | "signedOut" | "signedIn" | "suspended" | "error"
 *   reason: "sessionExpired" when status is "signedOut" because the session ended (else undefined)
 *   user: the record from GET /api/me (role, level, permissions[], emailVerified...), or null
 *   error: { kind: "network" | "claims" | "session" | "server" | "mfa", message } when status is "error"
 *   level, isVerified, suspendedReason: shortcuts derived from the above
 *   login(returnTo, { connection, prompt }), logout(), refresh(), retry(), getAuthHeaders(tokenOptions)
 *   expireSession(), markSuspended(reason), markUnverified(): used by useApi when the server says so
 */
export const AuthContext = createContext({ status: "unconfigured", user: null });

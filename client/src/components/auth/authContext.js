import { createContext } from "react";

// What every component can read about the signed-in user (via useAuth). AuthProvider writes it.
// status: "unconfigured" | "loading" | "signedOut" | "signedIn" | "error"
// Other fields: user (from GET /api/me), error, login(returnTo), logout(), refresh(), getAuthHeaders().
export const AuthContext = createContext({ status: "unconfigured", user: null });

import { createContext } from "react";

// openSignIn({ returnTo, variant }) opens the sign-in sheet. variant: "default" | "gated" | "expired".
// The default does nothing, so a component rendered without the provider (in a test) does not crash.
export const SignInPromptContext = createContext({ openSignIn: () => {} });

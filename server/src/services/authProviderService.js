// Talks to Auth0's Management API. Stubbed until the machine-to-machine app exists (docs/AUTH0_SETUP.md).
import { AppError } from "../utils/AppError.js";

/** Will ask Auth0 to send a new verification email. For now it says it cannot. */
export async function resendVerificationEmail() {
  throw new AppError(
    "RESEND_UNAVAILABLE",
    503,
    "We can't resend the email from here yet. Check your spam folder, or sign out and sign in again.",
  );
}

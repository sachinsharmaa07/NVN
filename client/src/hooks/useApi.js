import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "@/lib/toast";
import { useAuth } from "@/hooks/useAuth";
import { useSignInPrompt } from "@/hooks/useSignInPrompt";
import { t } from "@/i18n/t";
import { ME_KEY } from "@/hooks/useMe";
import { authedRequest } from "@/lib/authedRequest";
import { claimMfaAttempt } from "@/lib/mfaGuard";

/*
 * The one way screens call the API as the signed-in user:
 *   const api = useApi();
 *   const data = await api("/api/admin/users?limit=25");            // GET
 *   await api("/api/me", { method: "PATCH", body: { name: "Asha" } });
 *
 * It attaches the Bearer token, retries once on 401 (see authedRequest), and when the server's
 * answer means "this person is in the wrong state" it moves the UI to the right place, then
 * rethrows so the caller can still show its own error:
 *   EMAIL_NOT_VERIFIED -> toast + sign-in sheet (a fresh Google/email-OTP sign-in is verified)
 *   SUSPENDED -> /suspended
 *   MFA_REQUIRED -> fresh sign-in with prompt=login (once per tab, see lib/mfaGuard.js)
 *   401 (after the retry) -> sign-in sheet
 *   FORBIDDEN -> re-read /api/me, so a changed role makes the guards show the 403 in place
 */
export function useApi() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { openSignIn } = useSignInPrompt();
  const { getAuthHeaders, markSuspended, markUnverified, expireSession, login } = auth;
  const returnTo = location.pathname + location.search;

  return useCallback(
    async (path, options) => {
      try {
        return await authedRequest(getAuthHeaders, path, options);
      } catch (error) {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          markUnverified?.();
          toast.error(t("errors.auth.emailNotVerified"));
          openSignIn({ returnTo, variant: "gated" });
        } else if (error.code === "SUSPENDED") {
          markSuspended?.(error.details?.reason);
          navigate("/suspended", { replace: true });
        } else if (error.code === "MFA_REQUIRED") {
          // Only the first time: if the tenant never adds the MFA claim this would loop forever.
          if (claimMfaAttempt()) login?.(returnTo, { prompt: "login" });
        } else if (error.code === "FORBIDDEN") {
          queryClient.invalidateQueries({ queryKey: ME_KEY });
        } else if (error.status === 401 && error.code !== "TOKEN_CLAIMS_MISSING") {
          expireSession?.();
          openSignIn({ returnTo, variant: "expired" });
        }
        throw error;
      }
    },
    [
      queryClient,
      getAuthHeaders,
      markSuspended,
      markUnverified,
      expireSession,
      login,
      navigate,
      openSignIn,
      returnTo,
    ],
  );
}

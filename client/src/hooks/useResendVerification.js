import { useMutation } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// POST /api/me/resend-verification. The server rate-limits it (3 an hour) and answers 409 when
// the email is already verified; the page maps those codes to copy.
export function useResendVerification() {
  const api = useApi();
  return useMutation({
    mutationFn: () => api("/api/me/resend-verification", { method: "POST", body: {} }),
  });
}

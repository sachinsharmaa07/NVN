import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { useApi } from "@/hooks/useApi";
import { ME_KEY } from "@/hooks/useMe";
import { t } from "@/i18n/t";

// PATCH /api/me with { name, preferredLanguage, defaultPincode } (the server rejects any other key).
// The server answers with the saved user, which goes straight into the ["me"] cache, so the header
// and every page show the new name at once with no refetch. Not optimistic: the server may refuse.
export function useUpdateProfile() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => api("/api/me", { method: "PATCH", body: values }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(ME_KEY, user);
      toast.success(t("profile.toast.saved"));
    },
  });
}

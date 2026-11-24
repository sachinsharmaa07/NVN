import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// PATCH /api/admin/users/:id/status with { status: "active" | "suspended", reason }.
// Pessimistic, like useChangeRole.
export function useSetUserStatus() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...values }) =>
      api(`/api/admin/users/${id}/status`, { method: "PATCH", body: values }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

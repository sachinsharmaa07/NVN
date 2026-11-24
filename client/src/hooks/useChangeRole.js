import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// PATCH /api/admin/users/:id/role. NOT optimistic: it changes who can do what and writes an audit
// row, so the dialog waits for the server and only then closes. `values` = { role, reason,
// cityId?, departmentId?, stateCode? }.
export function useChangeRole() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...values }) =>
      api(`/api/admin/users/${id}/role`, { method: "PATCH", body: values }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

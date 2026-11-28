import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

/*
 * Add and rename a city's departments (POST / PATCH /api/admin/departments). Not optimistic. On success
 * both lists that show departments refetch: the Departments section (["geo", "departments", cityId])
 * and the category selects on City settings (["admin", "city-settings", ...]).
 * `cityId` is sent only for a super admin; a city admin always writes in their own city.
 */
function useRefresh(cityId) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["geo", "departments", cityId] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "city-settings"] }),
    ]);
}

export function useCreateDepartment(cityId, { sendCityId = false } = {}) {
  const api = useApi();
  const refresh = useRefresh(cityId);
  return useMutation({
    mutationFn: ({ name, code }) =>
      api("/api/admin/departments", {
        method: "POST",
        body: sendCityId ? { cityId, name, code } : { name, code },
      }),
    onSuccess: refresh,
  });
}

export function useRenameDepartment(cityId) {
  const api = useApi();
  const refresh = useRefresh(cityId);
  return useMutation({
    mutationFn: ({ id, name }) =>
      api(`/api/admin/departments/${id}`, { method: "PATCH", body: { name } }),
    onSuccess: refresh,
  });
}

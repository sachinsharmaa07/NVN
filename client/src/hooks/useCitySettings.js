import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { CATEGORIES } from "@/components/report/categories";
import { t } from "@/i18n/t";

// "water_leak" -> "Water leak": the labels the report wizard already uses.
export const categoryLabel = (value) =>
  t(CATEGORIES.find((c) => c.value === value)?.label ?? value);

export const citySettingsKey = (cityId) => ["admin", "city-settings", cityId ?? "own"];

/** A city admin's own city (no id), or the city a super admin picked. */
export function useCitySettings(cityId, { enabled = true } = {}) {
  const api = useApi();
  return useQuery({
    queryKey: citySettingsKey(cityId),
    enabled,
    queryFn: ({ signal }) =>
      api(`/api/admin/city-settings${cityId ? `?cityId=${cityId}` : ""}`, { signal }),
  });
}

/** Saves one category's routing and hours. Pessimistic: it changes where new reports go. */
export function useSaveCategory(cityId) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ category, ...body }) =>
      api(`/api/admin/city-settings/${category}`, {
        method: "PUT",
        body: cityId ? { ...body, cityId } : body,
      }),
    onSuccess: (row) => {
      toast.success(t("citySettings.saved", { category: categoryLabel(row.category) }));
      queryClient.setQueryData(citySettingsKey(cityId), (data) =>
        data
          ? {
              ...data,
              categories: data.categories.map((c) => (c.category === row.category ? row : c)),
            }
          : data,
      );
    },
  });
}

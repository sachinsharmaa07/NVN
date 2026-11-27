import { useMutation } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

/**
 * Deletes an abandoned draft's photos from Cloudinary: POST /api/uploads/discard (decision
 * M3-DISCARD). 404 (not your upload, or already gone) and 409 (already on an issue) leave nothing for
 * us to clean, so they count as done; any other failure is thrown for the caller to report.
 */
export function useDiscardPhotos() {
  const api = useApi();
  return useMutation({
    mutationFn: async (publicIds) => {
      if (!publicIds?.length) return;
      try {
        await api("/api/uploads/discard", { method: "POST", body: { publicIds } });
      } catch (error) {
        if (error.status !== 404 && error.status !== 409) throw error;
      }
    },
  });
}

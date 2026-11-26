import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { isValidPincode } from "@/pages/Landing/pincode";

// GET /api/pincodes/:pin, only once all 6 digits are a valid pincode. Directory data barely
// changes, so a looked-up pincode stays fresh for the session (the server caches it a day too).
export function useLookupPincode(pin) {
  const api = useApi();
  return useQuery({
    queryKey: ["pincode", pin],
    enabled: isValidPincode(pin),
    staleTime: Infinity,
    queryFn: ({ signal }) => api(`/api/pincodes/${pin}`, { signal }),
  });
}

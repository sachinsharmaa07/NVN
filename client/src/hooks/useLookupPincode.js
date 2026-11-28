import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { isValidPincode } from "@/pages/Landing/pincode";

// GET /api/pincodes/:pin, only once all 6 digits are a valid pincode. The endpoint is public, so no
// token: the landing page looks pincodes up for signed-out visitors too. Directory data barely
// changes, so a looked-up pincode stays fresh for the session (the server caches it a day too).
export function useLookupPincode(pin) {
  return useQuery({
    queryKey: ["pincode", pin],
    enabled: isValidPincode(pin),
    staleTime: Infinity,
    queryFn: ({ signal }) => apiGet(`/api/pincodes/${pin}`, { signal }),
  });
}

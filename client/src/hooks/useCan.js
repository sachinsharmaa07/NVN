import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission } from "@/lib/roles";

// can("user:read_scope") -> true/false. Cosmetic only: it hides things the user would be refused
// anyway. The server checks the real permission on every request.
export function useCan() {
  const { user } = useAuth();
  return useCallback((permission) => hasPermission(user, permission), [user]);
}

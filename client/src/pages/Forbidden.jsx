import { ForbiddenView } from "@/components/auth/ForbiddenView";

// The /forbidden route: the same block RequireAuth shows in place, reachable by address.
export default function Forbidden() {
  return <ForbiddenView />;
}

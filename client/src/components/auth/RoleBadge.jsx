import { Badge } from "@/components/ui/badge";
import { roleName } from "@/lib/roles";

// A role as an outline category tag. Status colours are reserved for issue status (UI.md §6),
// so every role looks the same; the text carries the meaning.
export function RoleBadge({ role }) {
  return <Badge variant="outline">{roleName(role)}</Badge>;
}

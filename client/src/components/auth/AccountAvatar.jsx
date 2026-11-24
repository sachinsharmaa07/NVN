import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

// The person's picture, or their initials when there is none (or it fails to load).
// Decorative: the name is always written next to it or in the button's label.
export function AccountAvatar({ user, className }) {
  return (
    <Avatar aria-hidden="true" className={cn("size-10", className)}>
      {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback>{initialsOf(user)}</AvatarFallback>
    </Avatar>
  );
}

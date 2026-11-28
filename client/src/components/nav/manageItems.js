import {
  Building2Icon,
  ListOrderedIcon,
  ScrollTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersRoundIcon,
} from "lucide-react";

/*
 * The admin pages, in one list for the sidebar's "Manage" group and the account menu (UI.md §5).
 * - permission: shown only to people who hold it (cosmetic; the server checks every request).
 * - minLevel: Users and City settings also need level 2+, as the account menu has always required.
 * - ready: false until the page exists (steps 10-11 flip them), so nobody sees a dead link.
 */
export const manageItems = [
  {
    to: "/moderation",
    labelKey: "shell.manage.moderation",
    icon: ShieldCheckIcon,
    permission: "post:moderate",
    ready: true,
  },
  {
    to: "/admin/users",
    labelKey: "shell.manage.users",
    icon: UsersRoundIcon,
    permission: "user:read_scope",
    minLevel: 2,
    ready: true,
  },
  {
    to: "/admin/city-settings",
    labelKey: "shell.manage.citySettings",
    icon: Settings2Icon,
    permission: "user:promote",
    minLevel: 2,
    ready: true,
  },
  {
    to: "/admin/cities",
    labelKey: "shell.manage.cities",
    icon: Building2Icon,
    permission: "city:onboard",
    ready: true,
  },
  {
    to: "/admin/waitlist",
    labelKey: "shell.manage.waitlist",
    icon: ListOrderedIcon,
    permission: "city:onboard",
    ready: true,
  },
  {
    to: "/admin/audit",
    labelKey: "shell.manage.audit",
    icon: ScrollTextIcon,
    permission: "audit:read",
    ready: true,
  },
];

/** The Manage items this person may open: `can` from useCan(), `level` from useAuth(). */
export function manageItemsFor(can, level = 0) {
  return manageItems.filter(
    (item) => item.ready && can(item.permission) && level >= (item.minLevel ?? 0),
  );
}

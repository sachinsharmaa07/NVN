import { ClipboardListIcon, HouseIcon, MapPinIcon, UsersIcon } from "lucide-react";

/*
 * The four places a citizen can go (docs/UI.md §5: max 4 items in the bottom bar).
 * One list feeds both the mobile bottom bar and the desktop sidebar, so they never disagree.
 * - labelKey: short label for the bottom bar; longLabelKey (optional): fuller label in the sidebar.
 * - primary: the one main action (Report). The bottom bar raises it; the sidebar shows it as a button.
 * - end: only active on an exact match ("/" would otherwise match every page).
 * Staff will get "Queue" in place of Report later.
 */
export const navItems = [
  { to: "/", labelKey: "shell.nav.home", icon: HouseIcon, end: true },
  { to: "/issues", labelKey: "shell.nav.issues", icon: ClipboardListIcon },
  {
    to: "/report",
    labelKey: "shell.nav.report",
    longLabelKey: "shell.nav.reportLong",
    icon: MapPinIcon,
    primary: true,
  },
  { to: "/community", labelKey: "shell.nav.community", icon: UsersIcon },
];

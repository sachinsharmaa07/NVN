import * as m from "motion/react-m";
import { NavLink } from "react-router";
import { t } from "@/i18n/t";
import { springs, useMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useCan } from "@/hooks/useCan";
import { useNavIntent } from "@/hooks/useNavIntent";
import { navItemsFor } from "./navItems";
import { focusRing } from "./navStyles";

/*
 * Mobile and tablet navigation (below 1024px, docs/UI.md §5): a 64px bar fixed to the bottom,
 * plus the phone's safe area (the home-indicator strip on iPhones) so nothing sits under it.
 * Four items; Report is the main action, so it is a filled tile raised above the bar.
 * NavLink adds aria-current="page" to the item for the page you are on.
 */
export function BottomBar() {
  const can = useCan();
  const navItems = navItemsFor(can("issue:read_scope"));
  return (
    <nav
      data-slot="bottom-bar"
      aria-label={t("shell.nav.label")}
      className="fixed inset-x-0 bottom-0 z-bottombar border-t bg-background shadow-md lg:hidden"
      // env() can't be written with Tailwind's spacing scale, so this one value is inline.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid h-16 grid-cols-4">
        {navItems.map((item) => (
          <li key={item.to} className="flex justify-center">
            {item.primary ? <PrimaryItem item={item} /> : <Item item={item} />}
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Home, My issues, Community: icon in a pill that fills in when active, label underneath.
// Active is shown three ways (pill, colour, weight), never by colour alone. The pill is a shared
// layout element, so it slides from the old item to the new one.
function Item({ item }) {
  const Icon = item.icon;
  const intent = useNavIntent(item.to);
  const transition = useMotionSafe(springs.snappy);
  return (
    <NavLink
      to={item.to}
      end={item.end}
      {...intent}
      className={({ isActive }) =>
        cn(
          "group flex h-full w-full flex-col items-center justify-center gap-1 rounded-md text-xs transition-colors duration-fast ease-standard",
          isActive
            ? "font-semibold text-foreground"
            : "text-muted-foreground hover:text-foreground",
          focusRing,
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative isolate flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-fast ease-standard group-aria-[current=page]:text-accent-foreground">
            {isActive && (
              <m.span
                aria-hidden="true"
                layoutId="bottombar-active"
                transition={transition}
                className="absolute inset-0 -z-10 rounded-full bg-accent"
              />
            )}
            <Icon aria-hidden="true" className="size-5" />
          </span>
          {t(item.labelKey)}
        </>
      )}
    </NavLink>
  );
}

// Report: a 64px filled tile lifted 12px above the bar. The ring in the page colour cuts it out
// from the bar's top border. It stays a normal link with a visible label (no icon-only button).
function PrimaryItem({ item }) {
  const Icon = item.icon;
  const intent = useNavIntent(item.to);
  return (
    <NavLink
      to={item.to}
      {...intent}
      className={cn(
        "-mt-3 flex size-16 flex-col items-center justify-center gap-1 rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-md ring-4 ring-background transition-colors duration-fast ease-standard hover:bg-primary/90",
        focusRing,
      )}
    >
      <Icon aria-hidden="true" className="size-6" />
      {t(item.labelKey)}
    </NavLink>
  );
}

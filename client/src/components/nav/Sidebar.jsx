import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import * as m from "motion/react-m";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useCan } from "@/hooks/useCan";
import { useNavIntent } from "@/hooks/useNavIntent";
import { usePagePrimaryClaimed } from "@/hooks/usePagePrimary";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { t } from "@/i18n/t";
import { springs, useMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { manageItemsFor } from "./manageItems";
import { navItemsFor } from "./navItems";
import { focusRing } from "./navStyles";

/*
 * Desktop navigation (1024px and up, docs/UI.md §5). Hidden below that by CSS, where the bottom
 * bar takes over. 16rem wide, or 3rem with icons only; the choice is saved (useSidebarCollapsed).
 * Top to bottom: the primary button, the pages, the "Manage" group (only what this person may open,
 * absent when nothing) and the collapse toggle at the foot. No brand here: the top bar already has it
 * (UI.md §1.2 limits the mark to TopBar, SuspendedLayout and the Landing footer).
 */
export function Sidebar() {
  const [collapsed, toggle] = useSidebarCollapsed();
  const can = useCan();
  const { level } = useAuth();
  const navItems = navItemsFor(can("issue:read_scope"));
  const primary = navItems.find((item) => item.primary);
  const links = navItems.filter((item) => !item.primary);
  const manage = manageItemsFor(can, level);
  const ToggleIcon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "hidden shrink-0 border-r bg-sidebar text-sidebar-foreground transition-[width] duration-base ease-standard lg:block",
        collapsed ? "w-12" : "w-64",
      )}
    >
      {/* Sticks under the 64px top bar and fills the rest of the screen, so the toggle sits at the foot. */}
      <div
        className={cn(
          "sticky top-16 flex h-below-topbar flex-col gap-2 py-4",
          collapsed ? "items-center" : "px-3",
        )}
      >
        <nav aria-label={t("shell.nav.label")} className="flex flex-col gap-2">
          <PrimaryLink item={primary} collapsed={collapsed} />
          <ul className="mt-2 flex flex-col gap-1">
            {links.map((item) => (
              <SideLink key={item.to} item={item} collapsed={collapsed} />
            ))}
          </ul>
        </nav>

        {manage.length > 0 && (
          <nav aria-labelledby="sidebar-manage" className="mt-4 flex flex-col gap-1">
            {/* A label, not a heading: the page's h1 should be the first heading on the page. */}
            <p
              id="sidebar-manage"
              className={cn(
                "px-3 text-sm font-medium text-muted-foreground",
                collapsed && "sr-only",
              )}
            >
              {t("shell.manage.label")}
            </p>
            <ul className="flex flex-col gap-1">
              {manage.map((item) => (
                <SideLink key={item.to} item={item} collapsed={collapsed} />
              ))}
            </ul>
          </nav>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={t(collapsed ? "shell.sidebar.expand" : "shell.sidebar.collapse")}
          className={cn("mt-auto text-muted-foreground", !collapsed && "self-end")}
        >
          <ToggleIcon aria-hidden="true" className="size-5" />
        </Button>
      </div>
    </aside>
  );
}

function PrimaryLink({ item, collapsed }) {
  const intent = useNavIntent(item.to);
  // Outline while the page shows its own primary, so each screen has one filled button (UI.md §6).
  const pageHasPrimary = usePagePrimaryClaimed();
  return (
    <WithTooltip show={collapsed} label={t(item.longLabelKey)}>
      <Button
        asChild
        variant={pageHasPrimary ? "outline" : "default"}
        size={collapsed ? "icon" : "default"}
        className="justify-start"
      >
        <NavLink to={item.to} aria-label={collapsed ? t(item.longLabelKey) : undefined} {...intent}>
          <item.icon aria-hidden="true" />
          {!collapsed && t(item.longLabelKey)}
        </NavLink>
      </Button>
    </WithTooltip>
  );
}

// One page link. The active background is a shared layout element, so it slides between items.
function SideLink({ item, collapsed }) {
  const intent = useNavIntent(item.to);
  const transition = useMotionSafe(springs.snappy);
  return (
    <li>
      <WithTooltip show={collapsed} label={t(item.labelKey)}>
        <NavLink
          to={item.to}
          end={item.end}
          aria-label={collapsed ? t(item.labelKey) : undefined}
          {...intent}
          className={({ isActive }) =>
            cn(
              // isolate: the sliding background sits behind the label but above the sidebar.
              "relative isolate flex h-11 items-center gap-3 rounded-md text-sm transition-colors duration-fast ease-standard",
              collapsed ? "w-11 justify-center" : "px-3",
              isActive
                ? "font-semibold text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              focusRing,
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <m.span
                  aria-hidden="true"
                  layoutId="sidebar-active"
                  transition={transition}
                  className="absolute inset-0 -z-10 rounded-md bg-sidebar-accent"
                />
              )}
              <item.icon aria-hidden="true" className="size-5 shrink-0" />
              {!collapsed && t(item.labelKey)}
            </>
          )}
        </NavLink>
      </WithTooltip>
    </li>
  );
}

// Icon-only items show their name in a tooltip on hover and keyboard focus. The aria-label above
// carries the name for screen readers, so the tooltip is only a visual hint (UI.md §6 Tooltip).
function WithTooltip({ show, label, children }) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

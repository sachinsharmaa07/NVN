import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { useCan } from "@/hooks/useCan";
import { navItemsFor } from "./navItems";
import { focusRing } from "./navStyles";

/*
 * Desktop navigation (1024px and up, docs/UI.md §5). Hidden below that by CSS, where the bottom
 * bar takes over. 16rem wide, or 3rem with icons only; the choice is saved (useSidebarCollapsed).
 * "Report an issue" comes first and is the primary button; the other pages follow as links.
 * A plain <nav> built on our tokens: shadcn's Sidebar needs several extra files we don't use yet.
 */
export function Sidebar() {
  const [collapsed, toggle] = useSidebarCollapsed();
  const can = useCan();
  const navItems = navItemsFor(can("issue:read_scope"));
  const primary = navItems.find((item) => item.primary);
  const links = navItems.filter((item) => !item.primary);
  const ToggleIcon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "hidden shrink-0 border-r bg-sidebar text-sidebar-foreground transition-[width] duration-base ease-standard lg:block",
        collapsed ? "w-12" : "w-64",
      )}
    >
      {/* Sticks under the 64px top bar while the page scrolls. */}
      <nav
        aria-label={t("shell.nav.label")}
        className={cn(
          "sticky top-16 flex flex-col gap-2 py-4",
          collapsed ? "items-center" : "px-3",
        )}
      >
        <WithTooltip show={collapsed} label={t(primary.longLabelKey)}>
          <Button asChild size={collapsed ? "icon" : "default"} className="justify-start">
            <NavLink to={primary.to} aria-label={collapsed ? t(primary.longLabelKey) : undefined}>
              <primary.icon aria-hidden="true" />
              {!collapsed && t(primary.longLabelKey)}
            </NavLink>
          </Button>
        </WithTooltip>

        <ul className="mt-2 flex flex-col gap-1">
          {links.map((item) => (
            <li key={item.to}>
              <WithTooltip show={collapsed} label={t(item.labelKey)}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  aria-label={collapsed ? t(item.labelKey) : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex h-11 items-center gap-3 rounded-md text-sm transition-colors duration-fast ease-standard",
                      collapsed ? "w-11 justify-center" : "px-3",
                      isActive
                        ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      focusRing,
                    )
                  }
                >
                  <item.icon aria-hidden="true" className="size-5 shrink-0" />
                  {!collapsed && t(item.labelKey)}
                </NavLink>
              </WithTooltip>
            </li>
          ))}
        </ul>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={t(collapsed ? "shell.sidebar.expand" : "shell.sidebar.collapse")}
          className={cn("mt-4 text-muted-foreground", !collapsed && "self-end")}
        >
          <ToggleIcon aria-hidden="true" className="size-5" />
        </Button>
      </nav>
    </aside>
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

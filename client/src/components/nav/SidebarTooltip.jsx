import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** A collapsed-sidebar item's name on hover and focus; loaded lazily by Sidebar (useSidebarTooltip). */
export default function SidebarTooltip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

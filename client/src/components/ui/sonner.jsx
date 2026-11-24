import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTheme } from "@/hooks/useTheme";

// Edited from shadcn: uses our ThemeProvider instead of next-themes, and applies docs/UI.md §6 rules
// (top-center on mobile, bottom-right above the chat bubble on desktop, 4s default, z-toast layer).
const Toaster = ({ ...props }) => {
  const { resolvedTheme } = useTheme();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return (
    <Sonner
      theme={resolvedTheme}
      position={isDesktop ? "bottom-right" : "top-center"}
      // Desktop: 24px edge + 56px chat bubble + 16px gap, so toasts sit above the bubble.
      offset={isDesktop ? { bottom: "6rem", right: "1.5rem" } : undefined}
      duration={4000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
        // Inline style beats sonner's own very large z-index, keeping toasts on our z-toast layer.
        zIndex: "var(--z-toast)",
      }}
      {...props}
    />
  );
};
export { Toaster };

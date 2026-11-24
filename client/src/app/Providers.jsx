import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./AuthProvider";
import { SignInPromptProvider } from "@/components/auth/SignInPromptProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";

// Everything the app needs around it. The router sits inside these (see main.jsx),
// so pages can use queries, theme, tooltips and toasts.
export function Providers({ children }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SignInPromptProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster />
            </TooltipProvider>
          </SignInPromptProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

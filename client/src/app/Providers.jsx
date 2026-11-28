import { QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig } from "motion/react";
import { AuthProvider } from "./AuthProvider";
import { SignInPromptProvider } from "@/components/auth/SignInPromptProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";

// Motion's features arrive in their own chunk after first paint; `strict` makes a stray `motion.`
// component throw, so nothing pulls the full bundle back into the main chunk.
const loadMotionFeatures = () => import("@/lib/motionFeatures").then((mod) => mod.default);

// Everything the app needs around it. The router sits inside these (see main.jsx),
// so pages can use queries, theme, tooltips, toasts and motion.
export function Providers({ children }) {
  return (
    <ThemeProvider>
      <LazyMotion features={loadMotionFeatures} strict>
        <MotionConfig reducedMotion="user">
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
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}

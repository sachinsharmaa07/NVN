import { QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig } from "motion/react";
import { AuthProvider } from "./AuthProvider";
import { SignInPromptProvider } from "@/components/auth/SignInPromptProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { lazy, Suspense } from "react";
import { queryClient } from "@/lib/queryClient";

// Motion's features arrive in their own chunk after first paint; `strict` makes a stray `motion.`
// component throw, so nothing pulls the full bundle back into the main chunk.
const loadMotionFeatures = () => import("@/lib/motionFeatures").then((mod) => mod.default);
// The toast container is in its own chunk too (HLD §7); toasts go through lib/toast.js.
const Toaster = lazy(() =>
  import("@/components/ui/sonner").then((mod) => ({ default: mod.Toaster })),
);

// Everything the app needs around it. The router sits inside these (see main.jsx),
// so pages can use queries, theme, toasts and motion. Each tooltip brings its own provider.
export function Providers({ children }) {
  return (
    <ThemeProvider>
      <LazyMotion features={loadMotionFeatures} strict>
        <MotionConfig reducedMotion="user">
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <SignInPromptProvider>
                {children}
                <Suspense fallback={null}>
                  <Toaster />
                </Suspense>
              </SignInPromptProvider>
            </AuthProvider>
          </QueryClientProvider>
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}

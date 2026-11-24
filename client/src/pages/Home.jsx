import { useQuery } from "@tanstack/react-query";
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { t } from "@/i18n/t";
import { apiGet } from "@/lib/api";

// The server answers 503 when it runs but the database is down; that is "down", not "unreachable".
const isDbDown = (error) => error?.status === 503;

// Phase 0 placeholder: says what Nivaran is and shows whether the API and database are up.
export function Home() {
  const health = useQuery({
    queryKey: ["health"],
    // TanStack Query passes a signal so leaving the page cancels the request.
    // Retries follow the app default (lib/queryClient.js): a 503 is a real answer, never retried.
    queryFn: ({ signal }) => apiGet("/api/health", { signal }),
  });

  return (
    <div className="mx-auto flex w-full max-w-160 animate-in flex-col gap-8 px-4 py-8 duration-base ease-enter fade-in slide-in-from-bottom-2 md:gap-12 md:px-6 md:py-12 lg:px-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl lg:text-4xl">{t("home.intro.title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("home.intro.body")}</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl">{t("home.health.title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          {/* Screen readers hear each change of this line without moving focus. */}
          <div role="status" aria-live="polite" className="w-full">
            <HealthLine health={health} />
          </div>
          {health.isError && !isDbDown(health.error) && (
            <Button variant="outline" onClick={() => health.refetch()} disabled={health.isFetching}>
              {t("common.retry")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HealthLine({ health }) {
  const showSkeleton = useDelayedFlag(health.isPending, 200);

  if (health.isPending) {
    return (
      <>
        <span className="sr-only">{t("home.health.checking")}</span>
        {showSkeleton && <Skeleton aria-hidden="true" className="h-6 w-56" />}
      </>
    );
  }
  if (health.isSuccess && health.data?.db === "up") {
    return (
      <p className="flex items-center gap-2">
        <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
        {t("home.health.ok")}
      </p>
    );
  }
  if (isDbDown(health.error) || health.data?.db === "down") {
    return (
      <p className="flex items-start gap-2">
        <TriangleAlertIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-destructive" />
        {t("home.health.down")}
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2">
      <CircleAlertIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-destructive" />
      {t("home.health.error")}
    </p>
  );
}

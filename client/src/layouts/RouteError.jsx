import { useEffect } from "react";
import { Link, useRouteError } from "react-router";
import { ErrorState } from "@/components/system/ErrorState";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";

/*
 * Shown inside the shell when a page throws while rendering or its code fails to download
 * (router.jsx puts it on the route that wraps every page). The top bar and navs stay, so the
 * person can still go somewhere else.
 */
export function RouteError() {
  const error = useRouteError();
  useEffect(() => {
    // Development only: production keeps the console clean; the server logs API failures.
    if (import.meta.env.DEV) console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
      <ErrorState
        titleAs="h1"
        title={t("shell.routeError.title")}
        body={t("shell.routeError.body")}
      />
      <div className="flex justify-center">
        <Button asChild>
          <Link to="/">{t("shell.routeError.home")}</Link>
        </Button>
      </div>
    </div>
  );
}

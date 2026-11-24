import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";

export function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-160 flex-col items-center gap-4 px-4 py-12 text-center md:px-6 lg:px-8">
      <h1 className="text-3xl lg:text-4xl">{t("notFound.page.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.page.body")}</p>
      <Button asChild>
        <Link to="/">{t("notFound.page.cta")}</Link>
      </Button>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

/**
 * A load that failed, with one way out: try again (02-lld §2). The page variant replaces a whole page's
 * content and is announced (`role="alert"`); the inline variant sits inside a section and stays quiet,
 * because the rest of the page still works.
 */
export function ErrorState({
  variant = "page",
  title,
  body = t("system.error.retryBody"),
  onRetry,
  retrying = false,
  titleAs: Title = "h2",
  className,
}) {
  const page = variant === "page";
  return (
    <div
      data-slot="error-state"
      role={page ? "alert" : undefined}
      className={cn(
        "fade-in flex flex-col gap-3",
        page ? "mx-auto max-w-md items-center px-4 py-12 text-center" : "items-start py-6",
        className,
      )}
    >
      <Title className="font-display text-h3 font-semibold text-foreground">{title}</Title>
      <p className="max-w-prose text-muted-foreground">{body}</p>
      {onRetry && (
        <Button variant="outline" loading={retrying} onClick={onRetry}>
          {retrying ? t("system.error.retrying") : t("system.error.retry")}
        </Button>
      )}
    </div>
  );
}

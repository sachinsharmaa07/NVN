import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

/**
 * The top of a page (02-lld §2): an optional back link, one h1, an optional description, an optional
 * meta row and optional actions. Stacks on phones and tablets; from 1024px the actions sit to the right,
 * aligned to the bottom of the text.
 * `titleAs` changes the heading tag only where a page already has its h1 (e.g. the style guide).
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  backTo,
  backLabel,
  titleAs: Title = "h1",
  className,
}) {
  return (
    <header data-slot="page-header" className={cn("flex flex-col gap-4", className)}>
      {backTo && (
        // step 04 adds useNavIntent here
        <Link
          to={backTo}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Title className="font-display text-h2 font-semibold text-foreground lg:text-h1">
            {title}
          </Title>
          {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
          {meta && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-col gap-3 lg:flex-row">{actions}</div>}
      </div>
    </header>
  );
}

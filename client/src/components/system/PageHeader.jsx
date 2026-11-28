import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";
import { useNavIntent } from "@/hooks/useNavIntent";
import { cn } from "@/lib/utils";

/**
 * The top of a page (02-lld §2): an optional back link, one h1, an optional description, an optional
 * meta row and optional actions. Stacks on phones and tablets; from 1024px the actions sit to the right,
 * aligned to the bottom of the text.
 * `titleAs` changes the heading tag only where a page already has its h1 (e.g. the style guide).
 * `inlineActions`: a quiet action (e.g. the wizard's Start over) sits on the title row, right-aligned, at
 * every width, instead of a row of its own under the text on phones. `titleRef` lets a page move focus
 * to the h1 (e.g. when the report becomes its receipt).
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  backTo,
  backLabel,
  titleAs: Title = "h1",
  inlineActions = false,
  titleRef,
  className,
}) {
  const heading = (
    <Title
      ref={titleRef}
      tabIndex={titleRef ? -1 : undefined}
      className="font-display text-h2 font-semibold text-foreground outline-none lg:text-h1"
    >
      {title}
    </Title>
  );
  return (
    <header data-slot="page-header" className={cn("flex flex-col gap-4", className)}>
      {backTo && <BackLink to={backTo} label={backLabel} />}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {inlineActions && actions ? (
            <div className="flex items-start justify-between gap-4">
              {heading}
              <div className="flex shrink-0 gap-3">{actions}</div>
            </div>
          ) : (
            heading
          )}
          {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
          {meta && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        {actions && !inlineActions && (
          <div className="flex flex-col gap-3 lg:flex-row">{actions}</div>
        )}
      </div>
    </header>
  );
}

// Its own component so the prefetch hook only runs when there is a back link.
function BackLink({ to, label }) {
  const intent = useNavIntent(to);
  return (
    <Link
      to={to}
      {...intent}
      className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

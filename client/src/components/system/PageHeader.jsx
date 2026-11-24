import { cn } from "@/lib/utils";

/**
 * The top of a page: one h1, an optional one-paragraph description and optional actions.
 * Stacks on phones; from 640px the actions sit to the right, aligned to the bottom of the text.
 * `titleAs` changes the heading tag only where a page already has its h1 (e.g. the style guide).
 */
export function PageHeader({ title, description, actions, titleAs: Title = "h1", className }) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <Title className="font-display text-3xl font-semibold text-foreground md:text-4xl">
          {title}
        </Title>
        {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

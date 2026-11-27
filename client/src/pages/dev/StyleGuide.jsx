import { PageHeader } from "@/components/system/PageHeader";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/t";
import {
  BadgeSection,
  ButtonSection,
  CardSection,
  FieldSection,
  SkeletonSection,
} from "./StyleGuideBasics";
import { BrandSection, EdgeSection, RevealSection, TypeSection } from "./StyleGuideFoundations";
import {
  CountdownSection,
  EmptyStateSection,
  PageHeaderSection,
  StatSection,
  TicketSection,
  TimelineSection,
} from "./StyleGuideSystem";

/**
 * Dev-only page (/dev/styleguide, added by the app shell): every shared component in every state.
 * The same sections render twice, inside a `.light` panel and a `.dark` panel, so both themes can be
 * checked side by side whatever theme the app itself is in (see the `.light` note in globals.css).
 */
export function StyleGuide() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 lg:px-8">
      <PageHeader
        title={t("system.styleGuide.title")}
        description={t("system.styleGuide.description")}
      />
      <p className="text-sm text-muted-foreground">{t("system.styleGuide.sampleNote")}</p>
      <div className="grid gap-8 lg:grid-cols-2">
        <ThemePanel theme="light" />
        <ThemePanel theme="dark" />
      </div>
    </div>
  );
}

function ThemePanel({ theme }) {
  // Element ids (inputs, error messages) must be unique on the page, so each panel prefixes them.
  const idPrefix = `sg-${theme}`;
  const headingId = `${idPrefix}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        theme,
        "flex min-w-0 flex-col gap-8 rounded-lg border bg-background p-4 text-foreground md:p-6",
      )}
    >
      <h2 id={headingId} className="text-2xl">
        {t(`system.styleGuide.${theme}`)}
      </h2>
      <TypeSection />
      <BrandSection />
      <EdgeSection />
      <ButtonSection />
      <CardSection />
      <BadgeSection />
      <FieldSection idPrefix={idPrefix} />
      <SkeletonSection />
      <PageHeaderSection />
      <EmptyStateSection />
      <TimelineSection />
      <CountdownSection />
      <TicketSection />
      <StatSection />
      <RevealSection />
    </section>
  );
}

export default StyleGuide;

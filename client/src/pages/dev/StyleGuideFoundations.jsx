import { BrandMark } from "@/components/system/BrandMark";
import { t } from "@/i18n/t";
import { Caption, StyleGuideSection } from "./StyleGuideSection";

// Type roles from docs/UI.md §1: mobile size first, then the desktop size from 1024px.
const TYPE_ROLES = [
  { key: "roleDisplay", className: "text-h2 lg:text-display", sizes: "31 / 49px" },
  { key: "roleH1", className: "text-h2 lg:text-h1", sizes: "31 / 39px" },
  { key: "roleH2", className: "text-2xl lg:text-h2", sizes: "25 / 31px" },
  { key: "roleH3", className: "text-h3", sizes: "20px" },
];

export function TypeSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.type")}>
      {TYPE_ROLES.map((role) => (
        <div key={role.key} className="flex flex-col gap-1">
          <Caption>
            {t(`system.styleGuide.${role.key}`)} {role.sizes}
          </Caption>
          <p className={`font-display font-semibold ${role.className}`}>
            {t("system.styleGuide.typeSample")}
          </p>
        </div>
      ))}
    </StyleGuideSection>
  );
}

export function BrandSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.brand")}>
      <BrandMark />
    </StyleGuideSection>
  );
}

// Uses the dropdown's data-slot so the real dark-mode rule in globals.css applies, not a copy of it.
export function EdgeSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.edge")}>
      <Caption>{t("system.styleGuide.edgeHint")}</Caption>
      <div
        data-slot="dropdown-menu-content"
        className="w-fit rounded-md border bg-popover p-4 text-popover-foreground shadow-md"
      >
        {t("system.styleGuide.edgeSample")}
      </div>
    </StyleGuideSection>
  );
}

export function RevealSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.reveal")}>
      <Caption>{t("system.styleGuide.revealHint")}</Caption>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="reveal-on-scroll rounded-md border bg-card p-4 text-card-foreground"
        >
          {t("system.styleGuide.revealSample", { n })}
        </div>
      ))}
    </StyleGuideSection>
  );
}

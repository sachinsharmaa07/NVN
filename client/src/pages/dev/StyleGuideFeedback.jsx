import { ErrorState } from "@/components/system/ErrorState";
import { FormStrip } from "@/components/system/FormStrip";
import { PhotoSlot } from "@/components/system/PhotoSlot";
import { t } from "@/i18n/t";
import { Caption, StyleGuideSection } from "./StyleGuideSection";

const noop = () => {};

export function ErrorStateSection() {
  const title = t("system.error.loadTitle", { thing: t("system.styleGuide.errorThing") });
  return (
    <StyleGuideSection title={t("system.styleGuide.errorState")}>
      <Caption>{t("system.styleGuide.errorPage")}</Caption>
      <div className="rounded-lg border bg-card">
        <ErrorState titleAs="h4" title={title} onRetry={noop} />
      </div>
      <Caption>{t("system.styleGuide.errorInline")}</Caption>
      <ErrorState variant="inline" titleAs="h4" title={title} onRetry={noop} />
      <Caption>{t("system.styleGuide.errorRetrying")}</Caption>
      <ErrorState variant="inline" titleAs="h4" title={title} onRetry={noop} retrying />
    </StyleGuideSection>
  );
}

export function PhotoSlotSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.photoSlot")}>
      <div className="grid grid-cols-2 gap-4">
        <PhotoSlot label={t("system.styleGuide.photoBefore")} />
        <PhotoSlot label={t("system.styleGuide.photoAfter")} />
      </div>
    </StyleGuideSection>
  );
}

export function FormStripSection() {
  const steps = ["One", "Two", "Three"].map((n) => ({
    title: t(`system.styleGuide.strip${n}`),
    body: t(`system.styleGuide.strip${n}Body`),
  }));
  return (
    <StyleGuideSection title={t("system.styleGuide.formStrip")}>
      <Caption>{t("system.styleGuide.stripPlain")}</Caption>
      <FormStrip steps={steps} />
      <Caption>{t("system.styleGuide.stripCurrent")}</Caption>
      <FormStrip steps={steps} current={1} />
    </StyleGuideSection>
  );
}

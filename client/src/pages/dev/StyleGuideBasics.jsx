import { useEffect, useState } from "react";
import { Camera, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/system/FieldError";
import { SlaBadge } from "@/components/system/SlaBadge";
import { StatusBadge } from "@/components/system/StatusBadge";
import { t } from "@/i18n/t";
import { Caption, StyleGuideSection } from "./StyleGuideSection";

const STATUSES = [
  "submitted",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "reopened",
  "rejected",
];
const SLA_STATES = ["on_track", "at_risk", "breached", "paused"];

export function ButtonSection() {
  // A real loading round trip: press, spin for 2 seconds, back to idle.
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return undefined;
    const timer = setTimeout(() => setBusy(false), 2000);
    return () => clearTimeout(timer);
  }, [busy]);

  return (
    <StyleGuideSection title={t("system.styleGuide.buttons")}>
      <Caption>{t("system.styleGuide.variants")}</Caption>
      <div className="flex flex-wrap items-center gap-2">
        <Button>{t("system.styleGuide.btnSubmit")}</Button>
        <Button variant="secondary">{t("system.styleGuide.btnDraft")}</Button>
        <Button variant="outline">
          <Camera aria-hidden="true" />
          {t("system.styleGuide.btnPhoto")}
        </Button>
        <Button variant="ghost">{t("system.styleGuide.btnFilter")}</Button>
        <Button variant="destructive">{t("system.styleGuide.btnReject")}</Button>
        <Button variant="link">{t("system.styleGuide.btnViewAll")}</Button>
      </div>
      <Caption>{t("system.styleGuide.sizes")}</Caption>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">{t("system.styleGuide.btnSmall")}</Button>
        <Button>{t("system.styleGuide.btnSubmit")}</Button>
        <Button size="lg">{t("system.styleGuide.btnLarge")}</Button>
        <Button size="icon" variant="outline" aria-label={t("system.styleGuide.btnIcon")}>
          <Search aria-hidden="true" />
        </Button>
      </div>
      <Caption>{t("system.styleGuide.states")}</Caption>
      <div className="flex flex-wrap items-center gap-2">
        <Button loading>{t("system.styleGuide.btnSubmit")}</Button>
        <Button loading={busy} onClick={() => setBusy(true)}>
          {t("system.styleGuide.btnTryLoading")}
        </Button>
        <Button disabled>{t("system.styleGuide.btnSubmit")}</Button>
        <Button variant="outline" disabled>
          {t("system.styleGuide.btnPhoto")}
        </Button>
      </div>
    </StyleGuideSection>
  );
}

export function CardSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.cards")}>
      <Card>
        <CardHeader>
          <CardTitle>{t("system.styleGuide.cardTitle")}</CardTitle>
          <CardDescription>{t("system.styleGuide.cardBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <StatusBadge status="in_progress" />
        </CardContent>
      </Card>
      <Card interactive asChild>
        <a href="/dev/styleguide#cards">
          <CardHeader>
            <CardTitle>{t("system.styleGuide.cardLinkTitle")}</CardTitle>
            <CardDescription>{t("system.styleGuide.cardLinkBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBadge status="assigned" />
          </CardContent>
        </a>
      </Card>
    </StyleGuideSection>
  );
}

export function BadgeSection() {
  return (
    <StyleGuideSection title={t("system.styleGuide.badges")}>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {SLA_STATES.map((state) => (
          <SlaBadge key={state} state={state} />
        ))}
      </div>
    </StyleGuideSection>
  );
}

export function FieldSection({ idPrefix }) {
  const id = (name) => `${idPrefix}-${name}`;
  return (
    <StyleGuideSection title={t("system.styleGuide.fields")}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor={id("pin")}>{t("system.styleGuide.pincodeLabel")}</Label>
          <Input id={id("pin")} inputMode="numeric" aria-describedby={id("pin-hint")} />
          <p id={id("pin-hint")} className="text-sm text-muted-foreground">
            {t("system.styleGuide.pincodeHint")}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("pin-bad")}>{t("system.styleGuide.pincodeLabel")}</Label>
          <Input
            id={id("pin-bad")}
            inputMode="numeric"
            defaultValue="1444"
            aria-invalid="true"
            aria-describedby={id("pin-bad-error")}
          />
          <FieldError id={id("pin-bad-error")}>{t("system.styleGuide.pincodeError")}</FieldError>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("details")}>{t("system.styleGuide.detailsLabel")}</Label>
          <Textarea id={id("details")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("details-bad")}>{t("system.styleGuide.detailsLabel")}</Label>
          <Textarea
            id={id("details-bad")}
            defaultValue={t("system.styleGuide.detailsSample")}
            aria-invalid="true"
            aria-describedby={id("details-bad-error")}
          />
          <FieldError id={id("details-bad-error")}>
            {t("system.styleGuide.detailsError")}
          </FieldError>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("ward")}>{t("system.styleGuide.wardLabel")}</Label>
          <Input id={id("ward")} disabled defaultValue={t("system.styleGuide.wardValue")} />
        </div>
      </div>
    </StyleGuideSection>
  );
}

export function SkeletonSection() {
  // Shapes match the content they stand in for: a badge, a title line, a detail line.
  return (
    <StyleGuideSection title={t("system.styleGuide.skeleton")}>
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
        <Skeleton className="h-6 w-24 rounded-sm" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </StyleGuideSection>
  );
}

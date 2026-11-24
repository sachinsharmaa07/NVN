import {
  ClockIcon,
  ConstructionIcon,
  DropletsIcon,
  ImageIcon,
  LightbulbIcon,
  Trash2Icon,
  WavesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n/t";

const DEPARTMENTS = [
  { key: "roads", Icon: ConstructionIcon },
  { key: "water", Icon: DropletsIcon },
  { key: "sanitation", Icon: Trash2Icon },
  { key: "streetlights", Icon: LightbulbIcon },
  { key: "drainage", Icon: WavesIcon },
];

/** What a citizen can hold the city to: a deadline, photos of the fix, and a named department. */
export function TrustSection() {
  return (
    <section aria-labelledby="landing-trust-title" className="flex flex-col gap-6">
      <h2 id="landing-trust-title" className="font-display text-2xl font-semibold">
        {t("landing.trust.title")}
      </h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Deadline />
          <Departments />
        </div>
        <BeforeAfter />
      </div>
    </section>
  );
}

function Deadline() {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-xl font-semibold">{t("landing.trust.deadlineTitle")}</h3>
      <p className="max-w-prose text-muted-foreground">{t("landing.trust.deadlineBody")}</p>
      {/* MOCK: example policy; real hours come from each city's SLA settings. */}
      <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
        <ClockIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t("landing.trust.deadlineExample")}</p>
          <p className="text-muted-foreground">{t("landing.trust.deadlineExpected")}</p>
        </div>
      </div>
    </div>
  );
}

function Departments() {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-xl font-semibold">{t("landing.trust.departmentsTitle")}</h3>
      <p className="max-w-prose text-muted-foreground">{t("landing.trust.departmentsBody")}</p>
      <ul className="flex flex-wrap gap-2">
        {DEPARTMENTS.map(({ key, Icon }) => (
          <li key={key}>
            <Badge variant="outline" className="h-8 gap-2 px-3 text-sm">
              <Icon aria-hidden="true" className="text-primary" />
              {t(`landing.trust.department.${key}`)}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Empty photo slots. aspect-ratio reserves their height before anything loads, so nothing
// jumps (no layout shift). Real photos later: <img width height loading="lazy" sizes=...>.
function BeforeAfter() {
  const slots = ["before", "after"];
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-xl font-semibold">{t("landing.trust.photosTitle")}</h3>
      <p className="max-w-prose text-muted-foreground">{t("landing.trust.photosBody")}</p>
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {slots.map((slot) => (
          <figure key={slot} className="flex flex-col gap-2">
            <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted p-3 text-center text-sm text-muted-foreground">
              <ImageIcon aria-hidden="true" className="size-6" />
              {t(`landing.trust.${slot}Placeholder`)}
            </div>
            <figcaption className="font-medium">{t(`landing.trust.${slot}`)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

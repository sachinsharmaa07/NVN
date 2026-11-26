import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { MapStep } from "@/components/report/MapStep";
import { PincodeStep } from "@/components/report/PincodeStep";
import { readDraft, saveDraft } from "@/components/report/reportDraft";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";
import { isValidPincode } from "@/pages/Landing/pincode";

const STEP_TITLES = ["report.wizard.step1", "report.wizard.step2", "report.wizard.step3"];

// The 3-step report wizard (docs/UI.md §7). The step lives in the URL (?step=1..3) so Back works.
// A landing link /report?pincode=144401 prefills step 1; otherwise the session draft does.
export function Report() {
  const [searchParams, setSearchParams] = useSearchParams();
  const step = ["2", "3"].includes(searchParams.get("step")) ? Number(searchParams.get("step")) : 1;
  const fromLink = searchParams.get("pincode");
  const draft = readDraft();
  const initialPin = isValidPincode(fromLink) ? fromLink : (draft.pincode ?? "");

  const goTo = (n) => setSearchParams({ step: String(n) });
  // Set when a submit comes back 422 OUTSIDE_PINCODE, shown once the map step opens again.
  const [mapNotice, setMapNotice] = useState("");
  const saved = draft.lng != null ? [draft.lng, draft.lat] : null;

  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("shell.report.title")} description={t("shell.report.description")} />
      <p className="text-sm font-medium text-muted-foreground">
        {t("report.wizard.stepOf", { step, total: 3, title: t(STEP_TITLES[step - 1]) })}
      </p>
      {step === 1 ? (
        <PincodeStep
          initialPin={initialPin}
          onNext={(pin) => {
            saveDraft({ pincode: pin });
            goTo(2);
          }}
        />
      ) : step === 2 ? (
        <MapStep
          pincode={draft.pincode}
          saved={saved}
          notice={mapNotice}
          onBack={() => goTo(1)}
          onNext={({ lat, lng, precision }) => {
            saveDraft({ lat, lng, precision });
            setMapNotice("");
            goTo(3);
          }}
        />
      ) : (
        // Steps 2 and 3 (map, photo and details) come with the next M1 batch.
        <EmptyState
          icon={MapPinIcon}
          title={t("shell.report.emptyTitle")}
          hint={t("shell.report.emptyHintPincode", { pincode: draft.pincode ?? "" })}
          action={
            <Button variant="outline" onClick={() => goTo(step - 1)}>
              {t("report.wizard.back")}
            </Button>
          }
        />
      )}
    </div>
  );
}

export default Report;
